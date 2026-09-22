import { Body, Controller, Get, HttpStatus, Post, Query, Req, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { Request } from "express";
import { SECURITY_ALERT_EVENTS, type AuditEventType } from "@secure-spreadsheet/shared";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { CurrentUser as CurrentUserValue } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { ErrorCodeException } from "../common/error-code.exception";
import { AuditLog, Notification } from "../database/entities";
import { DeviceGuard } from "../devices/device.guard";
import { AuditService } from "../audit/audit.service";
import { SettingsService } from "./settings.service";

const allowedClientEvents: AuditEventType[] = [
  "COPY_ATTEMPT",
  "CUT_ATTEMPT",
  "CONTEXT_MENU_ATTEMPT",
  "PRINT_ATTEMPT",
  "SCREENSHOT_SIGNAL"
];

export class ClientSecurityEventDto {
  @IsIn(allowedClientEvents)
  eventType!: AuditEventType;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;
}

@Controller()
export class SecurityEventsController {
  constructor(
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>
  ) {}

  @UseGuards(AuthGuard, DeviceGuard)
  @Roles("EMPLOYEE")
  @Post("security-events")
  async record(@Req() req: Request, @CurrentUser() user: CurrentUserValue, @Body() dto: ClientSecurityEventDto): Promise<{ ok: true }> {
    await this.audit.fromRequest(req, dto.eventType, {
      userId: user.id,
      deviceId: user.deviceId,
      resourceType: dto.resourceType ?? null,
      resourceId: dto.resourceId ?? null
    });
    return { ok: true };
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Get("admin/audit")
  listAudit(@Query("event") event?: string, @Query("scope") scope?: string): Promise<AuditLog[]> {
    return this.auditLogs.find({
      where: event
        ? { eventType: event as AuditEventType }
        : scope === "security"
          ? { eventType: In([...SECURITY_ALERT_EVENTS]) }
          : {},
      order: { timestamp: "DESC" },
      take: 200
    });
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Get("admin/audit/verify")
  verifyAudit(): Promise<{ ok: boolean; brokenAt: string | null; checked: number; message: string }> {
    return this.audit.verifyIntegrity().then((result) => ({
      ...result,
      message: result.ok ? "INTEGRIDAD CORRECTA" : "CADENA ALTERADA"
    }));
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Post("admin/security/lockdown/enable")
  async enableLockdown(@Req() req: Request, @CurrentUser() user: CurrentUserValue): Promise<{ enabled: boolean }> {
    await this.settings.setLockdown(true, user.id);
    await this.audit.fromRequest(req, "LOCKDOWN_ENABLED", { userId: user.id });
    return { enabled: true };
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Post("admin/security/lockdown/disable")
  async disableLockdown(@Req() req: Request, @CurrentUser() user: CurrentUserValue): Promise<{ enabled: boolean }> {
    await this.settings.setLockdown(false, user.id);
    await this.audit.fromRequest(req, "LOCKDOWN_DISABLED", { userId: user.id });
    return { enabled: false };
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Get("admin/security/lockdown")
  async getLockdown(): Promise<{ enabled: boolean }> {
    return { enabled: await this.settings.isLockdownEnabled() };
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Get("admin/notifications/unread")
  unreadNotifications(@CurrentUser() user: CurrentUserValue): Promise<Notification[]> {
    return this.notifications.find({
      where: { userId: user.id, readAt: IsNull() },
      order: { createdAt: "DESC" },
      take: 20
    });
  }

  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  @Post("admin/notifications/read-all")
  async markNotificationsRead(@CurrentUser() user: CurrentUserValue): Promise<{ ok: true }> {
    await this.notifications.update({ userId: user.id, readAt: IsNull() }, { readAt: new Date() });
    return { ok: true };
  }

  forbiddenDownload(): never {
    throw new ErrorCodeException("DOWNLOAD_FORBIDDEN", "Descarga prohibida.", HttpStatus.FORBIDDEN);
  }
}
