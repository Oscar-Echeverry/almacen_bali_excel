import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.entity";
import { Worksheet } from "./worksheet.entity";

@Entity({ name: "workbooks" })
export class WorkbookEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "original_filename", type: "varchar", length: 260 })
  originalFilename!: string;

  @Column({ name: "size_bytes", type: "bigint" })
  sizeBytes!: string;

  @Column({ name: "content_sha256", type: "varchar", length: 64 })
  contentSha256!: string;

  @Column({ name: "original_path", type: "text" })
  originalPath!: string;

  @Column({ name: "original_file_iv", type: "varchar", length: 64 })
  originalFileIv!: string;

  @Column({ name: "original_file_tag", type: "varchar", length: 64 })
  originalFileTag!: string;

  @Column({ name: "original_dek_iv", type: "varchar", length: 64 })
  originalDekIv!: string;

  @Column({ name: "original_dek_tag", type: "varchar", length: 64 })
  originalDekTag!: string;

  @Column({ name: "original_dek_encrypted", type: "text" })
  originalDekEncrypted!: string;

  @Index()
  @Column({ name: "uploaded_by", type: "uuid" })
  uploadedBy!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "uploaded_by" })
  uploader!: User;

  @Column({ type: "varchar", length: 24, default: "ACTIVE" })
  status!: "ACTIVE" | "ARCHIVED";

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @OneToMany(() => Worksheet, (worksheet) => worksheet.workbook)
  worksheets!: Worksheet[];
}
