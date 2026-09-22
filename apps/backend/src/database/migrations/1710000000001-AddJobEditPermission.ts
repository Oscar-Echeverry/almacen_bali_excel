import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddJobEditPermission1710000000001 implements MigrationInterface {
  name = "AddJobEditPermission1710000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS edit_enabled boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE jobs DROP COLUMN IF EXISTS edit_enabled`);
  }
}
