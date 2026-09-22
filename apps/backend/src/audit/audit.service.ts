import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { AuditEventType } from "@secure-spreadsheet/shared";
import type { Request } from "express";
import { DataSource, Repository } from "typeorm";
import { appConfig } from "../config/app-config";
import { AuditLog } from "../database/entities";

export interface AuditInput {
  eventType: AuditEventType;
  userId?: string | null;
  deviceId?: string | null;
  sessionPublicId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly key: Buffer;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>
  ) {
    this.key = this.loadKey();
  }

  async record(input: AuditInput): Promise<AuditLog> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(6842442)");
      const previous = await manager.findOne(AuditLog, {
        where: {},
        order: { timestamp: "DESC", id: "DESC" }
      });
      const timestamp = new Date();
      const canonical = this.canonicalPayload({
        timestamp: timestamp.toISOString(),
        eventType: input.eventType,
        userId: input.userId ?? null,
        deviceId: input.deviceId ?? null,
        sessionPublicId: input.sessionPublicId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? {}
      });
      const log = manager.create(AuditLog, {
        timestamp,
        eventType: input.eventType,
        userId: input.userId ?? null,
        deviceId: input.deviceId ?? null,
        sessionPublicId: input.sessionPublicId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? {},
        previousHash: previous?.hash ?? null,
        hash: this.computeHash(previous?.hash ?? null, canonical)
      });
      return manager.save(AuditLog, log);
    });
  }

  fromRequest(req: Request, eventType: AuditEventType, extra: Omit<AuditInput, "eventType" | "ip" | "userAgent" | "sessionPublicId"> = {}): Promise<AuditLog> {
    return this.record({
      ...extra,
      eventType,
      ip: req.ip ?? null,
      userAgent: req.header("user-agent") ?? null,
      sessionPublicId: req.session.sessionPublicId ?? null
    });
  }

  async verifyIntegrity(): Promise<{ ok: boolean; brokenAt: string | null; checked: number }> {
    const logs = await this.auditLogs.find({ order: { timestamp: "ASC", id: "ASC" } });
    let previousHash: string | null = null;
    let checked = 0;
    for (const log of logs) {
      const canonical = this.canonicalPayload({
        timestamp: log.timestamp.toISOString(),
        eventType: log.eventType,
        userId: log.userId,
        deviceId: log.deviceId,
        sessionPublicId: log.sessionPublicId,
        ip: log.ip,
        userAgent: log.userAgent,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        metadata: log.metadata
      });
      const expected = this.computeHash(previousHash, canonical);
      if (log.previousHash !== previousHash || log.hash !== expected) {
        return { ok: false, brokenAt: log.id, checked };
      }
      previousHash = log.hash;
      checked += 1;
    }
    return { ok: true, brokenAt: null, checked };
  }

  private computeHash(previousHash: string | null, canonicalPayload: string): string {
    return createHmac("sha256", this.key)
      .update(previousHash ?? "")
      .update(canonicalPayload)
      .digest("hex");
  }

  private canonicalPayload(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalPayload(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      const objectValue = value as Record<string, unknown>;
      return `{${Object.keys(objectValue).sort().map((key) => `${JSON.stringify(key)}:${this.canonicalPayload(objectValue[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  private loadKey(): Buffer {
    if (existsSync(appConfig.auditHmacKeyFile)) {
      return readFileSync(appConfig.auditHmacKeyFile);
    }
    if (appConfig.isProduction) {
      throw new Error("AUDIT_HMAC_KEY_FILE is missing");
    }
    return Buffer.from("development-only-audit-key-do-not-use-in-production", "utf8");
  }
}
