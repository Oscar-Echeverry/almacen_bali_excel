import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { WorkbookEntity } from "./workbook.entity";
import { CellChange } from "./cell-change.entity";

@Entity({ name: "worksheets" })
@Index(["workbookId", "orderIndex"], { unique: true })
export class Worksheet {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "workbook_id", type: "uuid" })
  workbookId!: string;

  @ManyToOne(() => WorkbookEntity, (workbook) => workbook.worksheets, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workbook_id" })
  workbook!: WorkbookEntity;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ name: "order_index", type: "integer" })
  orderIndex!: number;

  @Column({ type: "varchar", length: 20, default: "visible" })
  visibility!: string;

  @Column({ name: "row_count", type: "integer", default: 0 })
  rowCount!: number;

  @Column({ name: "column_count", type: "integer", default: 0 })
  columnCount!: number;

  @Column({ type: "jsonb", default: {} })
  metadata!: Record<string, unknown>;

  @OneToMany(() => CellChange, (change) => change.worksheet)
  changes!: CellChange[];
}
