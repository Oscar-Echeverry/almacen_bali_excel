import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { UserRole } from "@secure-spreadsheet/shared";
import { Device } from "./device.entity";
import { Job } from "./job.entity";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 320 })
  email!: string;

  @Column({ type: "varchar", length: 160 })
  name!: string;

  @Column({ name: "password_hash", type: "text" })
  passwordHash!: string;

  @Column({ type: "varchar", length: 20 })
  role!: UserRole;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ name: "must_change_password", type: "boolean", default: false })
  mustChangePassword!: boolean;

  @Column({ name: "mfa_enabled", type: "boolean", default: false })
  mfaEnabled!: boolean;

  @Column({ name: "mfa_secret_encrypted", type: "text", nullable: true })
  mfaSecretEncrypted!: string | null;

  @Column({ name: "failed_login_count", type: "integer", default: 0 })
  failedLoginCount!: number;

  @Column({ name: "locked_until", type: "timestamptz", nullable: true })
  lockedUntil!: Date | null;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: "active_session_id", type: "text", nullable: true })
  activeSessionId!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => Device, (device) => device.user)
  devices!: Device[];

  @OneToMany(() => Job, (job) => job.assignedUser)
  jobs!: Job[];
}
