import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Device } from "./device.entity";
import { Job } from "./job.entity";
import { User } from "./user.entity";
import { Worksheet } from "./worksheet.entity";

@Entity({ name: "cell_changes" })
export class CellChange {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "job_id", type: "uuid" })
  jobId!: string;

  @ManyToOne(() => Job, (job) => job.changes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "job_id" })
  job!: Job;

  @Index()
  @Column({ name: "worksheet_id", type: "uuid" })
  worksheetId!: string;

  @ManyToOne(() => Worksheet, (worksheet) => worksheet.changes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "worksheet_id" })
  worksheet!: Worksheet;

  @Index()
  @Column({ name: "cell_address", type: "varchar", length: 20 })
  cellAddress!: string;

  @Column({ name: "old_value", type: "jsonb", nullable: true })
  oldValue!: unknown;

  @Column({ name: "new_value", type: "jsonb", nullable: true })
  newValue!: unknown;

  @Column({ name: "modified_by", type: "uuid" })
  modifiedBy!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "modified_by" })
  modifier!: User;

  @Column({ name: "device_id", type: "uuid", nullable: true })
  deviceId!: string | null;

  @ManyToOne(() => Device, { onDelete: "SET NULL" })
  @JoinColumn({ name: "device_id" })
  device!: Device | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
