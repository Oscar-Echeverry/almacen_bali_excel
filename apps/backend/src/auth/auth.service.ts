import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import * as argon2 from "argon2";
import { Repository } from "typeorm";
import { appConfig } from "../config/app-config";
import { ErrorCodeException } from "../common/error-code.exception";
import { Device, User } from "../database/entities";
import { AuditService } from "../audit/audit.service";
import { MfaService } from "../mfa/mfa.service";
import { CryptoService } from "../security/crypto.service";
import { RedisService } from "../security/redis.service";
import { regenerateSession, destroySession } from "./session.util";
import { LoginDto } from "./dto";

export interface LoginResult {
  id: string;
  email: string;
  name: string;
  role: string;
  sessionPublicId: string;
  deviceStatus: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
    private readonly crypto: CryptoService,
    private readonly redis: RedisService
  ) {}

  async login(req: Request, dto: LoginDto): Promise<LoginResult> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email: normalizedEmail } });
    if (!user || !user.active) {
      await this.audit.fromRequest(req, "LOGIN_FAILED", { metadata: { email: normalizedEmail } });
      throw new ErrorCodeException("AUTH_INVALID", "Credenciales inválidas.", HttpStatus.UNAUTHORIZED);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.audit.fromRequest(req, "LOGIN_FAILED", { userId: user.id, metadata: { locked: true } });
      throw new ErrorCodeException("AUTH_LOCKED", "Acceso temporalmente bloqueado.", HttpStatus.TOO_MANY_REQUESTS);
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      await this.registerFailedLogin(req, user);
      throw new ErrorCodeException("AUTH_INVALID", "Credenciales inválidas.", HttpStatus.UNAUTHORIZED);
    }

    if (user.mfaEnabled) {
      const mfaOk = dto.mfaCode
        ? this.mfa.verifyTotp(user, dto.mfaCode)
        : dto.recoveryCode
          ? await this.mfa.consumeRecoveryCode(user, dto.recoveryCode)
          : false;
      if (!mfaOk) {
        await this.audit.fromRequest(req, "MFA_FAILED", { userId: user.id });
        throw new ErrorCodeException(dto.mfaCode || dto.recoveryCode ? "MFA_INVALID" : "MFA_REQUIRED", "MFA requerido.", HttpStatus.UNAUTHORIZED);
      }
      await this.audit.fromRequest(req, "MFA_SUCCESS", { userId: user.id });
    }

    const device = user.role === "EMPLOYEE" ? await this.resolveLoginDevice(req, user.id) : null;
    const previousSessionId = req.sessionID;
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.role = user.role;
    if (device) {
      req.session.deviceId = device.id;
      req.session.deviceFingerprint = device.certificateFingerprint;
    }
    const sessionPublicId = `SES-${this.crypto.randomToken(3).slice(0, 4).toUpperCase()}`;
    req.session.sessionPublicId = sessionPublicId;
    req.session.lastSeenAt = Date.now();
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    user.activeSessionId = req.sessionID;
    await this.users.save(user);
    if (device) {
      device.lastSeenAt = new Date();
      device.lastIp = req.ip ?? null;
      device.lastUserAgent = req.header("user-agent") ?? null;
      await this.devices.save(device);
    }
    await this.enforceSingleSession(user.id, req.sessionID, previousSessionId);
    await this.audit.fromRequest(req, "LOGIN_SUCCESS", { userId: user.id, deviceId: device?.id ?? null });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionPublicId,
      deviceStatus: device?.status ?? null
    };
  }

  async logout(req: Request): Promise<void> {
    await this.audit.fromRequest(req, "LOGOUT", { userId: req.session.userId ?? null, deviceId: req.session.deviceId ?? null });
    if (req.session.userId) {
      await this.users.update({ id: req.session.userId, activeSessionId: req.sessionID }, { activeSessionId: null });
    }
    await destroySession(req);
  }

  private async registerFailedLogin(req: Request, user: User): Promise<void> {
    user.failedLoginCount += 1;
    if (user.failedLoginCount >= appConfig.loginMaxAttempts) {
      user.lockedUntil = new Date(Date.now() + appConfig.loginLockMinutes * 60_000);
    }
    await this.users.save(user);
    await this.audit.fromRequest(req, "LOGIN_FAILED", { userId: user.id, metadata: { failedLoginCount: user.failedLoginCount } });
  }

  private async resolveLoginDevice(req: Request, userId: string): Promise<Device> {
    const fingerprint = this.currentFingerprint(req);
    if (!fingerprint) {
      throw new ErrorCodeException("DEVICE_REQUIRED", "Dispositivo autorizado requerido.", HttpStatus.FORBIDDEN);
    }
    const device = await this.devices.findOne({ where: { userId, certificateFingerprint: fingerprint } });
    if (!device) {
      await this.audit.fromRequest(req, "DEVICE_REJECTED", { userId, metadata: { fingerprint } });
      throw new ErrorCodeException("DEVICE_NOT_APPROVED", "Dispositivo no aprobado.", HttpStatus.FORBIDDEN);
    }
    if (device.status === "PENDING") {
      throw new ErrorCodeException("DEVICE_PENDING", "Dispositivo pendiente de aprobación.", HttpStatus.FORBIDDEN);
    }
    if (device.status === "REVOKED") {
      throw new ErrorCodeException("DEVICE_REVOKED", "Dispositivo revocado.", HttpStatus.FORBIDDEN);
    }
    return device;
  }

  private currentFingerprint(req: Request): string | null {
    if (appConfig.deviceSecurityMode === "development") {
      return req.header("X-Dev-Device-Fingerprint") ?? "DEV-APPROVED";
    }
    if (req.header("X-Client-Verify") !== "SUCCESS") {
      return null;
    }
    return req.header("X-Client-Fingerprint") ?? null;
  }

  private async enforceSingleSession(userId: string, sessionId: string, previousSessionId: string): Promise<void> {
    if (!appConfig.singleSessionPerUser) {
      return;
    }
    const ready = await this.redis.ping();
    if (!ready) {
      return;
    }
    const key = `active-session:${userId}`;
    const oldSessionId = await this.redis.raw.get(key);
    if (oldSessionId && oldSessionId !== sessionId && oldSessionId !== previousSessionId) {
      await this.redis.raw.del(`sess:${oldSessionId}`);
    }
    await this.redis.raw.set(key, sessionId, "EX", appConfig.sessionIdleTimeoutMinutes * 60);
  }
}
