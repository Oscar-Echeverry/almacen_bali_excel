import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "application_settings" })
export class ApplicationSetting {
  @PrimaryColumn({ type: "varchar", length: 120 })
  key!: string;

  @Column({ type: "jsonb" })
  value!: Record<string, unknown>;

  @Column({ name: "updated_by", type: "uuid", nullable: true })
  updatedBy!: string | null;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
