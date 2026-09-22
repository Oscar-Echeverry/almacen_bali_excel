import { createHash, randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { HttpStatus, Injectable, StreamableFile } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { GridRowDto, RowsPageDto } from "@secure-spreadsheet/shared";
import ExcelJS from "exceljs";
import { DataSource, Repository } from "typeorm";
import { AuditService } from "../audit/audit.service";
import { ErrorCodeException } from "../common/error-code.exception";
import { appConfig } from "../config/app-config";
import { CellChange, Job, Notification, User, WorkbookEntity, Worksheet } from "../database/entities";
import { CryptoService, EncryptedFileMetadata } from "../security/crypto.service";
import { CellPatchItemDto, CreateJobDto, UpdateJobPermissionsDto } from "./dto";
import { scalarValue, toSerializableCell, SerializableCellValue } from "./excel-value";

export interface WorkbookSummary {
  id: string;
  originalFilename: string;
  sizeBytes: string;
  worksheets: Array<{ id: string; name: string; rowCount: number; columnCount: number; columnWidths: Array<number | null> }>;
  createdAt: Date;
  status: string;
}

export interface JobSummary {
  id: string;
  workbookId: string;
  workbookName: string;
  worksheets: Array<{ id: string; name: string; rowCount: number; columnCount: number; columnWidths: Array<number | null> }>;
  assignedUserId: string;
  status: string;
  allowFormulaEditing: boolean;
  editEnabled: boolean;
  viewAccessEnabled: boolean;
  createdAt: Date;
  submittedAt: Date | null;
}

@Injectable()
export class ExcelService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WorkbookEntity)
    private readonly workbooks: Repository<WorkbookEntity>,
    @InjectRepository(Worksheet)
    private readonly worksheets: Repository<Worksheet>,
    @InjectRepository(Job)
    private readonly jobs: Repository<Job>,
    @InjectRepository(CellChange)
    private readonly changes: Repository<CellChange>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService
  ) {}

  async uploadWorkbook(file: Express.Multer.File, uploadedBy: string): Promise<WorkbookSummary> {
    this.validateUpload(file);
    const workbookId = randomUUID();
    const workbook = new ExcelJS.Workbook();
    await this.loadXlsxBuffer(workbook, file.buffer);
    const path = join(appConfig.storageDir, workbookId, "original.enc");
    const encrypted = this.crypto.encryptBufferToFile(file.buffer, path);
    const saved = await this.dataSource.transaction(async (manager) => {
      const entity = manager.create(WorkbookEntity, {
        id: workbookId,
        originalFilename: file.originalname,
        sizeBytes: String(file.size),
        contentSha256: createHash("sha256").update(file.buffer).digest("hex"),
        originalPath: encrypted.path,
        originalFileIv: encrypted.fileIv,
        originalFileTag: encrypted.fileTag,
        originalDekIv: encrypted.dekIv,
        originalDekTag: encrypted.dekTag,
        originalDekEncrypted: encrypted.dekEncrypted,
        uploadedBy,
        status: "ACTIVE"
      });
      const workbookEntity = await manager.save(WorkbookEntity, entity);
      const worksheets = workbook.worksheets.map((sheet, index) => manager.create(Worksheet, {
        workbookId: workbookEntity.id,
        name: sheet.name,
        orderIndex: index + 1,
        visibility: sheet.state ?? "visible",
        rowCount: Math.max(sheet.actualRowCount, sheet.rowCount),
        columnCount: Math.max(sheet.actualColumnCount, sheet.columnCount),
        metadata: {
          columnWidths: sheet.columns.map((column) => column.width ?? null)
        }
      }));
      await manager.save(Worksheet, worksheets);
      return workbookEntity;
    });
    await this.audit.record({ eventType: "WORKBOOK_UPLOADED", userId: uploadedBy, resourceType: "workbook", resourceId: saved.id });
    return this.getWorkbookSummary(saved.id);
  }

  async listWorkbooks(): Promise<WorkbookSummary[]> {
    const workbooks = await this.workbooks.find({ relations: { worksheets: true }, order: { createdAt: "DESC" } });
    return workbooks.map((workbook) => this.toWorkbookSummary(workbook));
  }

  async deleteWorkbook(workbookId: string, adminId: string): Promise<{ ok: true }> {
    const workbook = await this.workbooks.findOne({ where: { id: workbookId } });
    if (!workbook) {
      throw new ErrorCodeException("INVALID_WORKBOOK", "Archivo no encontrado.", HttpStatus.NOT_FOUND);
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Job, { workbookId });
      await manager.delete(WorkbookEntity, { id: workbookId });
    });
    this.removeWorkbookStorage(workbookId);
    await this.audit.record({ eventType: "WORKBOOK_DELETED", userId: adminId, resourceType: "workbook", resourceId: workbookId });
    return { ok: true };
  }

  async createJob(dto: CreateJobDto, createdBy: string): Promise<JobSummary> {
    const workbook = await this.workbooks.findOne({ where: { id: dto.workbookId } });
    if (!workbook) {
      throw new ErrorCodeException("INVALID_WORKBOOK", "Archivo no encontrado.", HttpStatus.NOT_FOUND);
    }
    const job = await this.jobs.save(this.jobs.create({
      workbookId: dto.workbookId,
      assignedUserId: dto.assignedUserId,
      createdBy,
      status: "ASSIGNED",
      allowFormulaEditing: dto.allowFormulaEditing ?? false,
      editEnabled: dto.editEnabled ?? true,
      viewAccessEnabled: dto.viewAccessEnabled ?? true,
      assignedAt: new Date()
    }));
    await this.audit.record({ eventType: "JOB_CREATED", userId: createdBy, resourceType: "job", resourceId: job.id, metadata: { editEnabled: job.editEnabled, viewAccessEnabled: job.viewAccessEnabled } });
    await this.audit.record({ eventType: "JOB_ASSIGNED", userId: createdBy, resourceType: "job", resourceId: job.id, metadata: { assignedUserId: dto.assignedUserId, editEnabled: job.editEnabled, viewAccessEnabled: job.viewAccessEnabled } });
    return this.getJobSummary(job.id);
  }

  async listAdminJobs(): Promise<JobSummary[]> {
    const jobs = await this.jobs.find({ relations: { workbook: { worksheets: true } }, order: { createdAt: "DESC" } });
    return jobs.map((job) => this.toJobSummary(job));
  }

  async deleteJob(jobId: string, adminId: string): Promise<{ ok: true }> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) {
      throw new ErrorCodeException("JOB_NOT_ASSIGNED", "Trabajo no encontrado.", HttpStatus.NOT_FOUND);
    }
    await this.jobs.delete({ id: jobId });
    await this.audit.record({
      eventType: "JOB_PERMISSION_UPDATED",
      userId: adminId,
      resourceType: "job",
      resourceId: jobId,
      metadata: { accessRemoved: true, assignedUserId: job.assignedUserId, workbookId: job.workbookId }
    });
    return { ok: true };
  }

  async listEmployeeJobs(userId: string): Promise<JobSummary[]> {
    const jobs = await this.jobs.find({ where: { assignedUserId: userId }, relations: { workbook: { worksheets: true } }, order: { createdAt: "DESC" } });
    return jobs
      .filter((job) => job.viewAccessEnabled && !["LOCKED", "ARCHIVED"].includes(job.status))
      .map((job) => this.toJobSummary(job));
  }

  async getRows(jobId: string, worksheetId: string, userId: string, sessionId: string, tabToken: string | undefined, start: number, requestedLimit: number): Promise<RowsPageDto> {
    const job = await this.mustGetEmployeeJob(jobId, userId);
    await this.ensureExclusiveJobSession(job, userId, null, sessionId, tabToken);
    const worksheet = await this.worksheets.findOne({ where: { id: worksheetId, workbookId: job.workbookId } });
    if (!worksheet) {
      throw new ErrorCodeException("INVALID_WORKBOOK", "Hoja no encontrada.", HttpStatus.NOT_FOUND);
    }
    await this.markJobStarted(job);
    const workbook = await this.loadWorkbook(job.workbook);
    const sheet = workbook.worksheets[worksheet.orderIndex - 1];
    if (!sheet) {
      throw new ErrorCodeException("INVALID_WORKBOOK", "Hoja inválida.", HttpStatus.NOT_FOUND);
    }
    const limit = Math.min(requestedLimit, appConfig.maxRowsPerRequest);
    const latest = await this.latestChanges(job.id, worksheet.id);
    const rows: GridRowDto[] = [];
    const totalRows = Math.max(sheet.actualRowCount, sheet.rowCount, worksheet.rowCount);
    const totalColumns = Math.max(sheet.actualColumnCount, sheet.columnCount, worksheet.columnCount);
    const end = Math.min(start + limit, totalRows);
    for (let rowNumber = start + 1; rowNumber <= end; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const cells = [];
      for (let columnNumber = 1; columnNumber <= totalColumns; columnNumber += 1) {
        const cell = row.getCell(columnNumber);
        const parsed = toSerializableCell(cell);
        const changed = latest.get(cell.address);
        cells.push({
          address: cell.address,
          value: changed ?? parsed.value,
          formula: parsed.formula,
          editable: job.editEnabled && job.status !== "SUBMITTED" && (!parsed.formula || job.allowFormulaEditing),
          modified: latest.has(cell.address)
        });
      }
      rows.push({ rowNumber, cells });
    }
    await this.audit.record({ eventType: "JOB_OPENED", userId, resourceType: "job", resourceId: jobId, metadata: { worksheetId, start, limit } });
    return {
      sheetId: worksheetId,
      start,
      limit,
      totalRows,
      rows
    };
  }

  async patchCells(jobId: string, userId: string, deviceId: string | null, sessionId: string, tabToken: string | undefined, changes: CellPatchItemDto[]): Promise<{ saved: number }> {
    const job = await this.mustGetEmployeeJob(jobId, userId);
    await this.ensureExclusiveJobSession(job, userId, deviceId, sessionId, tabToken);
    if (job.status === "SUBMITTED") {
      throw new ErrorCodeException("JOB_ALREADY_SUBMITTED", "Trabajo ya enviado.", HttpStatus.FORBIDDEN);
    }
    if (job.status === "LOCKED") {
      throw new ErrorCodeException("JOB_LOCKED", "Trabajo bloqueado.", HttpStatus.FORBIDDEN);
    }
    if (!job.editEnabled) {
      await this.audit.record({ eventType: "UNAUTHORIZED_ACCESS", userId, deviceId, resourceType: "job", resourceId: job.id, metadata: { reason: "edit_disabled" } });
      throw new ErrorCodeException("JOB_LOCKED", "Edición deshabilitada.", HttpStatus.FORBIDDEN);
    }
    let saved = 0;
    await this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`job:${job.id}`]);
      for (const change of changes) {
        const worksheet = await manager.findOne(Worksheet, { where: { id: change.worksheetId, workbookId: job.workbookId } });
        if (!worksheet) {
          throw new ErrorCodeException("INVALID_CELL", "Hoja inválida.", HttpStatus.BAD_REQUEST);
        }
        const current = await this.currentCellValue(job, worksheet, change.cellAddress);
        if (current.formula && !job.allowFormulaEditing) {
          throw new ErrorCodeException("INVALID_CELL", "La celda contiene fórmula y no puede editarse.", HttpStatus.FORBIDDEN);
        }
        await manager.save(CellChange, manager.create(CellChange, {
          jobId: job.id,
          worksheetId: worksheet.id,
          cellAddress: change.cellAddress,
          oldValue: current.value,
          newValue: change.newValue,
          modifiedBy: userId,
          deviceId
        }));
        saved += 1;
      }
    });
    await this.audit.record({ eventType: "CELL_MODIFIED", userId, deviceId, resourceType: "job", resourceId: job.id, metadata: { count: saved } });
    return { saved };
  }

  async submit(jobId: string, userId: string, deviceId: string | null, sessionId: string, tabToken: string | undefined): Promise<JobSummary> {
    const job = await this.mustGetEmployeeJob(jobId, userId);
    await this.ensureExclusiveJobSession(job, userId, deviceId, sessionId, tabToken);
    await this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`submit:${job.id}`]);
      const lockedJob = await manager.findOne(Job, { where: { id: job.id }, relations: { workbook: true } });
      if (!lockedJob) {
        throw new ErrorCodeException("JOB_NOT_ASSIGNED", "Trabajo no encontrado.", HttpStatus.NOT_FOUND);
      }
      if (lockedJob.status === "SUBMITTED") {
        throw new ErrorCodeException("JOB_ALREADY_SUBMITTED", "Trabajo ya enviado.", HttpStatus.FORBIDDEN);
      }
      if (lockedJob.status === "LOCKED") {
        throw new ErrorCodeException("JOB_LOCKED", "Trabajo bloqueado.", HttpStatus.FORBIDDEN);
      }
      if (!lockedJob.editEnabled) {
        throw new ErrorCodeException("JOB_LOCKED", "Edición deshabilitada.", HttpStatus.FORBIDDEN);
      }
      const resultBuffer = await this.generateResultWorkbook(lockedJob);
      const resultPath = join(appConfig.storageDir, lockedJob.workbookId, `result-${lockedJob.id}.enc`);
      const encrypted = this.crypto.encryptBufferToFile(resultBuffer, resultPath);
      lockedJob.status = "SUBMITTED";
      lockedJob.submittedAt = new Date();
      lockedJob.activeSessionId = null;
      lockedJob.activeTabToken = null;
      lockedJob.activeSeenAt = null;
      lockedJob.resultPath = encrypted.path;
      lockedJob.resultFileIv = encrypted.fileIv;
      lockedJob.resultFileTag = encrypted.fileTag;
      lockedJob.resultDekIv = encrypted.dekIv;
      lockedJob.resultDekTag = encrypted.dekTag;
      lockedJob.resultDekEncrypted = encrypted.dekEncrypted;
      await manager.save(Job, lockedJob);
    });
    await this.audit.record({ eventType: "JOB_SUBMITTED", userId, deviceId, resourceType: "job", resourceId: job.id });
    await this.notifyAdmins("JOB_SUBMITTED", `El empleado envió el archivo ${job.workbook.originalFilename}.`);
    return this.getJobSummary(job.id);
  }

  async heartbeat(jobId: string, userId: string, deviceId: string | null, sessionId: string, tabToken: string | undefined): Promise<{ ok: true }> {
    const job = await this.mustGetEmployeeJob(jobId, userId);
    await this.ensureExclusiveJobSession(job, userId, deviceId, sessionId, tabToken);
    return { ok: true };
  }

  async release(jobId: string, userId: string, sessionId: string, tabToken: string | undefined): Promise<{ ok: true }> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (job?.assignedUserId === userId && job.activeSessionId === sessionId && job.activeTabToken === tabToken) {
      job.activeSessionId = null;
      job.activeTabToken = null;
      job.activeSeenAt = null;
      await this.jobs.save(job);
    }
    return { ok: true };
  }

  async lockJob(jobId: string, adminId: string): Promise<JobSummary> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) {
      throw new ErrorCodeException("JOB_NOT_ASSIGNED", "Trabajo no encontrado.", HttpStatus.NOT_FOUND);
    }
    job.status = "LOCKED";
    job.lockedAt = new Date();
    job.lockedBy = adminId;
    await this.jobs.save(job);
    await this.audit.record({ eventType: "JOB_LOCKED", userId: adminId, resourceType: "job", resourceId: jobId });
    return this.getJobSummary(jobId);
  }

  async updateJobPermissions(jobId: string, adminId: string, dto: UpdateJobPermissionsDto): Promise<JobSummary> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) {
      throw new ErrorCodeException("JOB_NOT_ASSIGNED", "Trabajo no encontrado.", HttpStatus.NOT_FOUND);
    }
    const previous = {
      viewAccessEnabled: job.viewAccessEnabled,
      editEnabled: job.editEnabled,
      allowFormulaEditing: job.allowFormulaEditing
    };
    if (dto.editEnabled !== undefined) {
      job.editEnabled = dto.editEnabled;
    }
    if (dto.viewAccessEnabled !== undefined) {
      job.viewAccessEnabled = dto.viewAccessEnabled;
      if (!dto.viewAccessEnabled) {
        job.editEnabled = false;
        job.activeSessionId = null;
        job.activeTabToken = null;
        job.activeSeenAt = null;
      }
    }
    if (dto.allowFormulaEditing !== undefined) {
      job.allowFormulaEditing = dto.allowFormulaEditing;
    }
    const changed =
      previous.viewAccessEnabled !== job.viewAccessEnabled ||
      previous.editEnabled !== job.editEnabled ||
      previous.allowFormulaEditing !== job.allowFormulaEditing;
    if (!changed) {
      return this.getJobSummary(jobId);
    }
    await this.jobs.save(job);
    await this.audit.record({
      eventType: "JOB_PERMISSION_UPDATED",
      userId: adminId,
      resourceType: "job",
      resourceId: jobId,
      metadata: {
        permissionChanged: true,
        previous,
        viewAccessEnabled: job.viewAccessEnabled,
        editEnabled: job.editEnabled,
        allowFormulaEditing: job.allowFormulaEditing
      }
    });
    return this.getJobSummary(jobId);
  }

  async downloadOriginal(workbookId: string, adminId: string): Promise<StreamableFile> {
    const workbook = await this.workbooks.findOne({ where: { id: workbookId } });
    if (!workbook) {
      throw new ErrorCodeException("INVALID_WORKBOOK", "Archivo no encontrado.", HttpStatus.NOT_FOUND);
    }
    await this.audit.record({ eventType: "ADMIN_DOWNLOAD_ORIGINAL", userId: adminId, resourceType: "workbook", resourceId: workbookId });
    return new StreamableFile(this.crypto.decryptFileToBuffer(this.originalMetadata(workbook)), {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: `attachment; filename="${workbook.originalFilename.replace(/"/g, "")}"`
    });
  }

  async downloadResult(jobId: string, adminId: string): Promise<StreamableFile> {
    const job = await this.jobs.findOne({ where: { id: jobId }, relations: { workbook: true } });
    if (!job?.resultPath || !job.resultDekEncrypted || !job.resultDekIv || !job.resultDekTag || !job.resultFileIv || !job.resultFileTag) {
      throw new ErrorCodeException("INVALID_WORKBOOK", "Resultado no disponible.", HttpStatus.NOT_FOUND);
    }
    await this.audit.record({ eventType: "ADMIN_DOWNLOAD_RESULT", userId: adminId, resourceType: "job", resourceId: jobId });
    return new StreamableFile(this.crypto.decryptFileToBuffer({
      path: job.resultPath,
      fileIv: job.resultFileIv,
      fileTag: job.resultFileTag,
      dekIv: job.resultDekIv,
      dekTag: job.resultDekTag,
      dekEncrypted: job.resultDekEncrypted
    }), {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: `attachment; filename="result-${job.workbook.originalFilename.replace(/"/g, "")}"`
    });
  }

  async getChanges(jobId: string): Promise<CellChange[]> {
    return this.changes.find({ where: { jobId }, order: { createdAt: "ASC" }, relations: { worksheet: true, modifier: true, device: true } });
  }

  private async ensureExclusiveJobSession(
    job: Job,
    userId: string,
    deviceId: string | null,
    sessionId: string,
    tabToken: string | undefined
  ): Promise<void> {
    if (!tabToken || tabToken.length > 120) {
      await this.audit.record({ eventType: "UNAUTHORIZED_ACCESS", userId, deviceId, resourceType: "job", resourceId: job.id, metadata: { reason: "missing_workspace_token" } });
      throw new ErrorCodeException("UNAUTHORIZED_ACCESS", "No se pudo validar esta pestaña.", HttpStatus.FORBIDDEN);
    }

    const expired = !job.activeSeenAt || job.activeSeenAt.getTime() < Date.now() - 30_000;
    const sameTab = job.activeSessionId === sessionId && job.activeTabToken === tabToken;
    if (job.activeSessionId && job.activeTabToken && !expired && !sameTab) {
      await this.audit.record({
        eventType: "UNAUTHORIZED_ACCESS",
        userId,
        deviceId,
        resourceType: "job",
        resourceId: job.id,
        metadata: { reason: "already_open_elsewhere" }
      });
      throw new ErrorCodeException("UNAUTHORIZED_ACCESS", "Este archivo ya está abierto en otra pestaña o navegador.", HttpStatus.FORBIDDEN);
    }

    job.activeSessionId = sessionId;
    job.activeTabToken = tabToken;
    job.activeSeenAt = new Date();
    await this.jobs.save(job);
  }

  private async notifyAdmins(type: string, message: string): Promise<void> {
    const admins = await this.users.find({ where: { role: "ADMIN", active: true } });
    if (admins.length === 0) {
      return;
    }
    await this.notifications.save(admins.map((admin) => this.notifications.create({
      userId: admin.id,
      type,
      message,
      readAt: null
    })));
  }

  private removeWorkbookStorage(workbookId: string): void {
    const root = resolve(appConfig.storageDir);
    const target = resolve(root, workbookId);
    if (target !== root && target.startsWith(`${root}${sep}`) && existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
    }
  }

  private validateUpload(file: Express.Multer.File): void {
    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      throw new ErrorCodeException("INVALID_WORKBOOK", "Solo se aceptan archivos .xlsx.", HttpStatus.BAD_REQUEST);
    }
    if (file.originalname.toLowerCase().match(/\.(xls|xlsm|xlsb)$/)) {
      throw new ErrorCodeException("INVALID_WORKBOOK", "Formato Excel no permitido.", HttpStatus.BAD_REQUEST);
    }
    if (file.size > appConfig.maxUploadMb * 1024 * 1024) {
      throw new ErrorCodeException("INVALID_WORKBOOK", "Archivo demasiado grande.", HttpStatus.BAD_REQUEST);
    }
    const magic = file.buffer.subarray(0, 4).toString("hex");
    if (magic !== "504b0304" && magic !== "504b0506" && magic !== "504b0708") {
      throw new ErrorCodeException("INVALID_WORKBOOK", "El archivo no parece ser un XLSX válido.", HttpStatus.BAD_REQUEST);
    }
  }

  private async getWorkbookSummary(id: string): Promise<WorkbookSummary> {
    const workbook = await this.workbooks.findOne({ where: { id }, relations: { worksheets: true } });
    if (!workbook) {
      throw new ErrorCodeException("INVALID_WORKBOOK", "Archivo no encontrado.", HttpStatus.NOT_FOUND);
    }
    return this.toWorkbookSummary(workbook);
  }

  private async getJobSummary(id: string): Promise<JobSummary> {
    const job = await this.jobs.findOne({ where: { id }, relations: { workbook: { worksheets: true } } });
    if (!job) {
      throw new ErrorCodeException("JOB_NOT_ASSIGNED", "Trabajo no encontrado.", HttpStatus.NOT_FOUND);
    }
    return this.toJobSummary(job);
  }

  private toWorkbookSummary(workbook: WorkbookEntity): WorkbookSummary {
    const worksheets = (workbook.worksheets ?? []).sort((a, b) => a.orderIndex - b.orderIndex);
    return {
      id: workbook.id,
      originalFilename: workbook.originalFilename,
      sizeBytes: workbook.sizeBytes,
      worksheets: worksheets.map((sheet) => this.toWorksheetSummary(sheet)),
      createdAt: workbook.createdAt,
      status: workbook.status
    };
  }

  private toJobSummary(job: Job): JobSummary {
    return {
      id: job.id,
      workbookId: job.workbookId,
      workbookName: job.workbook?.originalFilename ?? "",
      worksheets: (job.workbook?.worksheets ?? [])
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((sheet) => this.toWorksheetSummary(sheet)),
      assignedUserId: job.assignedUserId,
      status: job.status,
      allowFormulaEditing: job.allowFormulaEditing,
      editEnabled: job.editEnabled,
      viewAccessEnabled: job.viewAccessEnabled,
      createdAt: job.createdAt,
      submittedAt: job.submittedAt
    };
  }

  private toWorksheetSummary(sheet: Worksheet): { id: string; name: string; rowCount: number; columnCount: number; columnWidths: Array<number | null> } {
    return {
      id: sheet.id,
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      columnWidths: this.columnWidths(sheet)
    };
  }

  private columnWidths(sheet: Worksheet): Array<number | null> {
    const raw = sheet.metadata?.columnWidths;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((width) => typeof width === "number" && Number.isFinite(width) ? width : null);
  }

  private async mustGetEmployeeJob(jobId: string, userId: string): Promise<Job> {
    const job = await this.jobs.findOne({ where: { id: jobId }, relations: { workbook: true } });
    if (!job || job.assignedUserId !== userId) {
      throw new ErrorCodeException("JOB_NOT_ASSIGNED", "Trabajo no asignado.", HttpStatus.FORBIDDEN);
    }
    if (!job.viewAccessEnabled) {
      throw new ErrorCodeException("UNAUTHORIZED_ACCESS", "Acceso al archivo retirado.", HttpStatus.FORBIDDEN);
    }
    if (job.status === "LOCKED") {
      throw new ErrorCodeException("JOB_LOCKED", "Trabajo bloqueado.", HttpStatus.FORBIDDEN);
    }
    if (job.status === "ARCHIVED") {
      throw new ErrorCodeException("JOB_LOCKED", "Trabajo archivado.", HttpStatus.FORBIDDEN);
    }
    return job;
  }

  private async markJobStarted(job: Job): Promise<void> {
    if (job.status === "ASSIGNED") {
      job.status = "IN_PROGRESS";
      job.startedAt = new Date();
      await this.jobs.save(job);
    }
  }

  private async loadWorkbook(workbook: WorkbookEntity): Promise<ExcelJS.Workbook> {
    const excel = new ExcelJS.Workbook();
    await this.loadXlsxBuffer(excel, this.crypto.decryptFileToBuffer(this.originalMetadata(workbook)));
    return excel;
  }

  private async loadXlsxBuffer(workbook: ExcelJS.Workbook, buffer: Buffer): Promise<void> {
    type ExcelJsLoadBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];
    await workbook.xlsx.load(buffer as unknown as ExcelJsLoadBuffer);
  }

  private originalMetadata(workbook: WorkbookEntity): EncryptedFileMetadata {
    return {
      path: workbook.originalPath,
      fileIv: workbook.originalFileIv,
      fileTag: workbook.originalFileTag,
      dekIv: workbook.originalDekIv,
      dekTag: workbook.originalDekTag,
      dekEncrypted: workbook.originalDekEncrypted
    };
  }

  private async latestChanges(jobId: string, worksheetId: string): Promise<Map<string, SerializableCellValue>> {
    const changes = await this.changes.find({ where: { jobId, worksheetId }, order: { createdAt: "ASC" } });
    const latest = new Map<string, SerializableCellValue>();
    for (const change of changes) {
      latest.set(change.cellAddress, scalarValue(change.newValue));
    }
    return latest;
  }

  private async currentCellValue(job: Job, worksheet: Worksheet, address: string): Promise<{ value: SerializableCellValue; formula: string | null }> {
    const latest = await this.latestChanges(job.id, worksheet.id);
    if (latest.has(address)) {
      return { value: latest.get(address) ?? null, formula: null };
    }
    const workbook = await this.loadWorkbook(job.workbook);
    const sheet = workbook.worksheets[worksheet.orderIndex - 1];
    if (!sheet) {
      throw new ErrorCodeException("INVALID_CELL", "Hoja inválida.", HttpStatus.BAD_REQUEST);
    }
    return toSerializableCell(sheet.getCell(address));
  }

  private async generateResultWorkbook(job: Job): Promise<Buffer> {
    const workbook = await this.loadWorkbook(job.workbook);
    const worksheets = await this.worksheets.find({ where: { workbookId: job.workbookId } });
    for (const worksheet of worksheets) {
      const sheet = workbook.worksheets[worksheet.orderIndex - 1];
      if (!sheet) {
        continue;
      }
      const latest = await this.latestChanges(job.id, worksheet.id);
      for (const [address, value] of latest) {
        const parsed = toSerializableCell(sheet.getCell(address));
        if (parsed.formula && !job.allowFormulaEditing) {
          continue;
        }
        sheet.getCell(address).value = value;
      }
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
