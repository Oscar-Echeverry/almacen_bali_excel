import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import type { DeviceStatus } from "@secure-spreadsheet/shared";
import { User } from "./user.entity";

@Entity({ name: "devices" })
export class Device {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, (user) => user.devices, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "varchar", length: 160 })
  name!: string;

  @Index({ unique: true })
  @Column({ name: "certificate_serial", type: "varchar", length: 120 })
  certificateSerial!: string;

  @Index({ unique: true })
  @Column({ name: "certificate_fingerprint", type: "varchar", length: 128 })
  certificateFingerprint!: string;

  @Column({ name: "certificate_subject", type: "text" })
  certificateSubject!: string;

  @Index()
  @Column({ type: "varchar", length: 20 })
  status!: DeviceStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "approved_at", type: "timestamptz", nullable: true })
  approvedAt!: Date | null;

  @Column({ name: "approved_by", type: "uuid", nullable: true })
  approvedBy!: string | null;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt!: Date | null;

  @Column({ name: "revoked_by", type: "uuid", nullable: true })
  revokedBy!: string | null;

  @Column({ name: "last_seen_at", type: "timestamptz", nullable: true })
  lastSeenAt!: Date | null;

  @Column({ name: "last_ip", type: "inet", nullable: true })
  lastIp!: string | null;

  @Column({ name: "last_user_agent", type: "text", nullable: true })
  lastUserAgent!: string | null;
}
