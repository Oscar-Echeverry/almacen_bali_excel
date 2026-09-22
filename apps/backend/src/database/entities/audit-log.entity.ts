import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import type { AuditEventType } from "@secure-spreadsheet/shared";

@Entity({ name: "audit_logs" })
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "timestamptz" })
  timestamp!: Date;

  @Index()
  @Column({ name: "event_type", type: "varchar", length: 80 })
  eventType!: AuditEventType;

  @Index()
  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId!: string | null;

  @Index()
  @Column({ name: "device_id", type: "uuid", nullable: true })
  deviceId!: string | null;

  @Column({ name: "session_public_id", type: "varchar", length: 32, nullable: true })
  sessionPublicId!: string | null;

  @Column({ type: "inet", nullable: true })
  ip!: string | null;

  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent!: string | null;

  @Column({ name: "resource_type", type: "varchar", length: 80, nullable: true })
  resourceType!: string | null;

  @Column({ name: "resource_id", type: "varchar", length: 120, nullable: true })
  resourceId!: string | null;

  @Column({ type: "jsonb", default: {} })
  metadata!: Record<string, unknown>;

  @Column({ name: "previous_hash", type: "varchar", length: 64, nullable: true })
  previousHash!: string | null;

  @Column({ type: "varchar", length: 64 })
  hash!: string;
}
