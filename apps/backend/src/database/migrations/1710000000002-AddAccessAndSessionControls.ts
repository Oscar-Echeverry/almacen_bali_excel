import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccessAndSessionControls1710000000002 implements MigrationInterface {
  name = "AddAccessAndSessionControls1710000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_id text NULL`);
    await queryRunner.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS view_access_enabled boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS active_session_id text NULL`);
    await queryRunner.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS active_tab_token varchar(120) NULL`);
    await queryRunner.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS active_seen_at timestamptz NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE jobs DROP COLUMN IF EXISTS active_seen_at`);
    await queryRunner.query(`ALTER TABLE jobs DROP COLUMN IF EXISTS active_tab_token`);
    await queryRunner.query(`ALTER TABLE jobs DROP COLUMN IF EXISTS active_session_id`);
    await queryRunner.query(`ALTER TABLE jobs DROP COLUMN IF EXISTS view_access_enabled`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS active_session_id`);
  }
}
