import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { Repository } from "typeorm";
import { AuditService } from "../audit/audit.service";
import { ErrorCodeException } from "../common/error-code.exception";
import { appConfig } from "../config/app-config";
import { Device } from "../database/entities";
import { SettingsService } from "../security/settings.service";
import { destroySession } from "../auth/session.util";

@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
    private readonly audit: AuditService,
    private readonly settings: SettingsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.session.role !== "EMPLOYEE") {
      return true;
    }
    if (await this.settings.isLockdownEnabled()) {
      throw new ErrorCodeException("LOCKDOWN_ACTIVE", "Modo de emergencia activo.", HttpStatus.FORBIDDEN);
    }
    const fingerprint = this.currentFingerprint(req);
    if (!fingerprint) {
      await this.audit.fromRequest(req, "UNAUTHORIZED_ACCESS", { userId: req.session.userId ?? null, metadata: { reason: "missing_client_certificate" } });
      throw new ErrorCodeException("DEVICE_REQUIRED", "Certificado de dispositivo requerido.", HttpStatus.FORBIDDEN);
    }
    const userId = req.session.userId;
    const deviceId = req.session.deviceId;
    if (!userId || !deviceId) {
      throw new ErrorCodeException("DEVICE_SESSION_MISMATCH", "Sesión de dispositivo incompleta.", HttpStatus.FORBIDDEN);
    }
    const device = await this.devices.findOne({
      where: {
        id: deviceId,
        userId,
        certificateFingerprint: fingerprint
      }
    });
    if (!device || req.session.deviceFingerprint !== fingerprint) {
      await this.audit.fromRequest(req, "DEVICE_SESSION_MISMATCH", { userId: req.session.userId ?? null, deviceId: req.session.deviceId ?? null });
      await destroySession(req);
      throw new ErrorCodeException("DEVICE_SESSION_MISMATCH", "La sesión no coincide con el dispositivo.", HttpStatus.FORBIDDEN);
    }
    if (device.status === "PENDING") {
      throw new ErrorCodeException("DEVICE_PENDING", "Dispositivo pendiente de aprobación.", HttpStatus.FORBIDDEN);
    }
    if (device.status === "REVOKED") {
      throw new ErrorCodeException("DEVICE_REVOKED", "Dispositivo revocado.", HttpStatus.FORBIDDEN);
    }
    device.lastSeenAt = new Date();
    device.lastIp = req.ip ?? null;
    device.lastUserAgent = req.header("user-agent") ?? null;
    await this.devices.save(device);
    return true;
  }

  private currentFingerprint(req: Request): string | null {
    if (appConfig.deviceSecurityMode === "development") {
      return req.header("X-Dev-Device-Fingerprint") ?? req.session.deviceFingerprint ?? "DEV-APPROVED";
    }
    if (req.header("X-Client-Verify") !== "SUCCESS") {
      return null;
    }
    return req.header("X-Client-Fingerprint") ?? null;
  }
}
