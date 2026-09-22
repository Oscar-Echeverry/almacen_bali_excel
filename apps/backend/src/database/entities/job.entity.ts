import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import type { JobStatus } from "@secure-spreadsheet/shared";
import { CellChange } from "./cell-change.entity";
import { User } from "./user.entity";
import { WorkbookEntity } from "./workbook.entity";

@Entity({ name: "jobs" })
export class Job {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "workbook_id", type: "uuid" })
  workbookId!: string;

  @ManyToOne(() => WorkbookEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "workbook_id" })
  workbook!: WorkbookEntity;

  @Index()
  @Column({ name: "assigned_user_id", type: "uuid" })
  assignedUserId!: string;

  @ManyToOne(() => User, (user) => user.jobs, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "assigned_user_id" })
  assignedUser!: User;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @Index()
  @Column({ type: "varchar", length: 24 })
  status!: JobStatus;

  @Column({ name: "allow_formula_editing", type: "boolean", default: false })
  allowFormulaEditing!: boolean;

  @Column({ name: "edit_enabled", type: "boolean", default: true })
  editEnabled!: boolean;

  @Column({ name: "view_access_enabled", type: "boolean", default: true })
  viewAccessEnabled!: boolean;

  @Column({ name: "active_session_id", type: "text", nullable: true })
  activeSessionId!: string | null;

  @Column({ name: "active_tab_token", type: "varchar", length: 120, nullable: true })
  activeTabToken!: string | null;

  @Column({ name: "active_seen_at", type: "timestamptz", nullable: true })
  activeSeenAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "assigned_at", type: "timestamptz", nullable: true })
  assignedAt!: Date | null;

  @Column({ name: "started_at", type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ name: "submitted_at", type: "timestamptz", nullable: true })
  submittedAt!: Date | null;

  @Column({ name: "locked_at", type: "timestamptz", nullable: true })
  lockedAt!: Date | null;

  @Column({ name: "locked_by", type: "uuid", nullable: true })
  lockedBy!: string | null;

  @Column({ name: "result_path", type: "text", nullable: true })
  resultPath!: string | null;

  @Column({ name: "result_file_iv", type: "varchar", length: 64, nullable: true })
  resultFileIv!: string | null;

  @Column({ name: "result_file_tag", type: "varchar", length: 64, nullable: true })
  resultFileTag!: string | null;

  @Column({ name: "result_dek_iv", type: "varchar", length: 64, nullable: true })
  resultDekIv!: string | null;

  @Column({ name: "result_dek_tag", type: "varchar", length: 64, nullable: true })
  resultDekTag!: string | null;

  @Column({ name: "result_dek_encrypted", type: "text", nullable: true })
  resultDekEncrypted!: string | null;

  @OneToMany(() => CellChange, (change) => change.job)
  changes!: CellChange[];
}
