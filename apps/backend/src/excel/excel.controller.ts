import { Body, Controller, Delete, Get, Headers, HttpStatus, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import type { RowsPageDto } from "@secure-spreadsheet/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { CurrentUser as CurrentUserValue } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { DeviceGuard } from "../devices/device.guard";
import { AuditService } from "../audit/audit.service";
import { ErrorCodeException } from "../common/error-code.exception";
import { appConfig } from "../config/app-config";
import { CellChange } from "../database/entities";
import { CreateJobDto, PatchCellsDto, RowsQueryDto, UpdateJobPermissionsDto } from "./dto";
import { ExcelService, JobSummary, WorkbookSummary } from "./excel.service";

@Controller()
export class ExcelController {
  constructor(
    private readonly excel: ExcelService,
    private readonly audit: AuditService
  ) {}

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Get("admin/workbooks")
  listWorkbooks(): Promise<WorkbookSummary[]> {
    return this.excel.listWorkbooks();
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Post("admin/workbooks")
  @UseInterceptors(FileInterceptor("file", { limits: { files: 1, fileSize: appConfig.maxUploadMb * 1024 * 1024 } }))
  uploadWorkbook(@CurrentUser() user: CurrentUserValue, @UploadedFile() file: Express.Multer.File): Promise<WorkbookSummary> {
    return this.excel.uploadWorkbook(file, user.id);
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Delete("admin/workbooks/:id")
  deleteWorkbook(@CurrentUser() user: CurrentUserValue, @Param("id") id: string): Promise<{ ok: true }> {
    return this.excel.deleteWorkbook(id, user.id);
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Get("admin/workbooks/:id/original")
  downloadOriginal(@CurrentUser() user: CurrentUserValue, @Param("id") id: string) {
    return this.excel.downloadOriginal(id, user.id);
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Post("admin/jobs")
  createJob(@CurrentUser() user: CurrentUserValue, @Body() dto: CreateJobDto): Promise<JobSummary> {
    return this.excel.createJob(dto, user.id);
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Get("admin/jobs")
  listAdminJobs(): Promise<JobSummary[]> {
    return this.excel.listAdminJobs();
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Get("admin/jobs/:id/changes")
  getChanges(@Param("id") id: string): Promise<CellChange[]> {
    return this.excel.getChanges(id);
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Delete("admin/jobs/:id")
  deleteJob(@CurrentUser() user: CurrentUserValue, @Param("id") id: string): Promise<{ ok: true }> {
    return this.excel.deleteJob(id, user.id);
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Get("admin/jobs/:id/result")
  downloadResult(@CurrentUser() user: CurrentUserValue, @Param("id") id: string) {
    return this.excel.downloadResult(id, user.id);
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Post("admin/jobs/:id/lock")
  lockJob(@CurrentUser() user: CurrentUserValue, @Param("id") id: string): Promise<JobSummary> {
    return this.excel.lockJob(id, user.id);
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Patch("admin/jobs/:id/permissions")
  updateJobPermissions(
    @CurrentUser() user: CurrentUserValue,
    @Param("id") id: string,
    @Body() dto: UpdateJobPermissionsDto
  ): Promise<JobSummary> {
    return this.excel.updateJobPermissions(id, user.id, dto);
  }

  @UseGuards(AuthGuard, DeviceGuard)
  @Roles("EMPLOYEE")
  @Get("jobs")
  listEmployeeJobs(@CurrentUser() user: CurrentUserValue): Promise<JobSummary[]> {
    return this.excel.listEmployeeJobs(user.id);
  }

  @UseGuards(AuthGuard, DeviceGuard)
  @Roles("EMPLOYEE")
  @Get("jobs/:jobId/sheets/:sheetId/rows")
  getRows(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserValue,
    @Param("jobId") jobId: string,
    @Param("sheetId") sheetId: string,
    @Query() query: RowsQueryDto,
    @Headers("x-workspace-token") workspaceToken?: string
  ): Promise<RowsPageDto> {
    return this.excel.getRows(jobId, sheetId, user.id, req.sessionID, workspaceToken, query.start, query.limit);
  }

  @UseGuards(AuthGuard, DeviceGuard)
  @Roles("EMPLOYEE")
  @Patch("jobs/:jobId/cells")
  patchCells(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserValue,
    @Param("jobId") jobId: string,
    @Body() dto: PatchCellsDto,
    @Headers("x-workspace-token") workspaceToken?: string
  ): Promise<{ saved: number }> {
    return this.excel.patchCells(jobId, user.id, user.deviceId, req.sessionID, workspaceToken, dto.changes);
  }

  @UseGuards(AuthGuard, DeviceGuard)
  @Roles("EMPLOYEE")
  @Post("jobs/:jobId/submit")
  submit(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserValue,
    @Param("jobId") jobId: string,
    @Headers("x-workspace-token") workspaceToken?: string
  ): Promise<JobSummary> {
    return this.excel.submit(jobId, user.id, user.deviceId, req.sessionID, workspaceToken);
  }

  @UseGuards(AuthGuard, DeviceGuard)
  @Roles("EMPLOYEE")
  @Post("jobs/:jobId/heartbeat")
  heartbeat(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserValue,
    @Param("jobId") jobId: string,
    @Headers("x-workspace-token") workspaceToken?: string
  ): Promise<{ ok: true }> {
    return this.excel.heartbeat(jobId, user.id, user.deviceId, req.sessionID, workspaceToken);
  }

  @UseGuards(AuthGuard, DeviceGuard)
  @Roles("EMPLOYEE")
  @Post("jobs/:jobId/release")
  release(
    @Req() req: Request,
    @CurrentUser() user: CurrentUserValue,
    @Param("jobId") jobId: string,
    @Headers("x-workspace-token") workspaceToken?: string
  ): Promise<{ ok: true }> {
    return this.excel.release(jobId, user.id, req.sessionID, workspaceToken);
  }

  @UseGuards(AuthGuard, DeviceGuard)
  @Roles("EMPLOYEE")
  @Get("jobs/:jobId/export")
  async exportForbidden(@Req() req: Request, @CurrentUser() user: CurrentUserValue, @Param("jobId") jobId: string): Promise<never> {
    await this.audit.fromRequest(req, "EXPORT_ATTEMPT", { userId: user.id, deviceId: user.deviceId, resourceType: "job", resourceId: jobId });
    throw new ErrorCodeException("EXPORT_FORBIDDEN", "Exportación prohibida.", HttpStatus.FORBIDDEN);
  }

  @UseGuards(AuthGuard, DeviceGuard)
  @Roles("EMPLOYEE")
  @Get("jobs/:jobId/original")
  async originalForbidden(@Req() req: Request, @CurrentUser() user: CurrentUserValue, @Param("jobId") jobId: string): Promise<never> {
    await this.audit.fromRequest(req, "DOWNLOAD_ATTEMPT", { userId: user.id, deviceId: user.deviceId, resourceType: "job", resourceId: jobId });
    throw new ErrorCodeException("DOWNLOAD_FORBIDDEN", "Descarga prohibida.", HttpStatus.FORBIDDEN);
  }

  @UseGuards(AuthGuard, DeviceGuard)
  @Roles("EMPLOYEE")
  @Get("jobs/:jobId/result")
  async resultForbidden(@Req() req: Request, @CurrentUser() user: CurrentUserValue, @Param("jobId") jobId: string): Promise<never> {
    await this.audit.fromRequest(req, "DOWNLOAD_ATTEMPT", { userId: user.id, deviceId: user.deviceId, resourceType: "job", resourceId: jobId });
    throw new ErrorCodeException("DOWNLOAD_FORBIDDEN", "Descarga prohibida.", HttpStatus.FORBIDDEN);
  }
}
