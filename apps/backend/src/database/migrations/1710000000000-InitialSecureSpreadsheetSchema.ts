import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSecureSpreadsheetSchema1710000000000 implements MigrationInterface {
  name = "InitialSecureSpreadsheetSchema1710000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(320) NOT NULL UNIQUE,
        name varchar(160) NOT NULL,
        password_hash text NOT NULL,
        role varchar(20) NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE')),
        active boolean NOT NULL DEFAULT true,
        must_change_password boolean NOT NULL DEFAULT false,
        mfa_enabled boolean NOT NULL DEFAULT false,
        mfa_secret_encrypted text NULL,
        failed_login_count integer NOT NULL DEFAULT 0,
        locked_until timestamptz NULL,
        last_login_at timestamptz NULL,
        active_session_id text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name varchar(160) NOT NULL,
        certificate_serial varchar(120) NOT NULL UNIQUE,
        certificate_fingerprint varchar(128) NOT NULL UNIQUE,
        certificate_subject text NOT NULL,
        status varchar(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REVOKED')),
        created_at timestamptz NOT NULL DEFAULT now(),
        approved_at timestamptz NULL,
        approved_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        revoked_at timestamptz NULL,
        revoked_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        last_seen_at timestamptz NULL,
        last_ip inet NULL,
        last_user_agent text NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_devices_user_id ON devices(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_devices_status ON devices(status)`);
    await queryRunner.query(`
      CREATE TABLE device_enrollment_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash varchar(128) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at timestamptz NULL,
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_device_enrollment_tokens_user_id ON device_enrollment_tokens(user_id)`);
    await queryRunner.query(`
      CREATE TABLE workbooks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        original_filename varchar(260) NOT NULL,
        size_bytes bigint NOT NULL,
        content_sha256 varchar(64) NOT NULL,
        original_path text NOT NULL,
        original_file_iv varchar(64) NOT NULL,
        original_file_tag varchar(64) NOT NULL,
        original_dek_iv varchar(64) NOT NULL,
        original_dek_tag varchar(64) NOT NULL,
        original_dek_encrypted text NOT NULL,
        uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status varchar(24) NOT NULL DEFAULT 'ACTIVE',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_workbooks_uploaded_by ON workbooks(uploaded_by)`);
    await queryRunner.query(`
      CREATE TABLE worksheets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workbook_id uuid NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
        name varchar(120) NOT NULL,
        order_index integer NOT NULL,
        visibility varchar(20) NOT NULL DEFAULT 'visible',
        row_count integer NOT NULL DEFAULT 0,
        column_count integer NOT NULL DEFAULT 0,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        UNIQUE(workbook_id, order_index)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_worksheets_workbook_id ON worksheets(workbook_id)`);
    await queryRunner.query(`
      CREATE TABLE jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workbook_id uuid NOT NULL REFERENCES workbooks(id) ON DELETE RESTRICT,
        assigned_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status varchar(24) NOT NULL CHECK (status IN ('DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'LOCKED', 'ARCHIVED')),
        allow_formula_editing boolean NOT NULL DEFAULT false,
        edit_enabled boolean NOT NULL DEFAULT true,
        view_access_enabled boolean NOT NULL DEFAULT true,
        active_session_id text NULL,
        active_tab_token varchar(120) NULL,
        active_seen_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        assigned_at timestamptz NULL,
        started_at timestamptz NULL,
        submitted_at timestamptz NULL,
        locked_at timestamptz NULL,
        locked_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        result_path text NULL,
        result_file_iv varchar(64) NULL,
        result_file_tag varchar(64) NULL,
        result_dek_iv varchar(64) NULL,
        result_dek_tag varchar(64) NULL,
        result_dek_encrypted text NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_jobs_workbook_id ON jobs(workbook_id)`);
    await queryRunner.query(`CREATE INDEX idx_jobs_assigned_user_id ON jobs(assigned_user_id)`);
    await queryRunner.query(`CREATE INDEX idx_jobs_status ON jobs(status)`);
    await queryRunner.query(`
      CREATE TABLE cell_changes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        worksheet_id uuid NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
        cell_address varchar(20) NOT NULL,
        old_value jsonb NULL,
        new_value jsonb NULL,
        modified_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        device_id uuid NULL REFERENCES devices(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_cell_changes_job_id ON cell_changes(job_id)`);
    await queryRunner.query(`CREATE INDEX idx_cell_changes_worksheet_id ON cell_changes(worksheet_id)`);
    await queryRunner.query(`CREATE INDEX idx_cell_changes_cell_address ON cell_changes(cell_address)`);
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp timestamptz NOT NULL,
        event_type varchar(80) NOT NULL,
        user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        device_id uuid NULL REFERENCES devices(id) ON DELETE SET NULL,
        session_public_id varchar(32) NULL,
        ip inet NULL,
        user_agent text NULL,
        resource_type varchar(80) NULL,
        resource_id varchar(120) NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        previous_hash varchar(64) NULL,
        hash varchar(64) NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp)`);
    await queryRunner.query(`CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type)`);
    await queryRunner.query(`CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_audit_logs_device_id ON audit_logs(device_id)`);
    await queryRunner.query(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type varchar(120) NOT NULL,
        message text NOT NULL,
        read_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_notifications_user_id ON notifications(user_id)`);
    await queryRunner.query(`
      CREATE TABLE mfa_recovery_codes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash varchar(128) NOT NULL UNIQUE,
        used_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_mfa_recovery_codes_user_id ON mfa_recovery_codes(user_id)`);
    await queryRunner.query(`
      CREATE TABLE application_settings (
        key varchar(120) PRIMARY KEY,
        value jsonb NOT NULL,
        updated_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      INSERT INTO application_settings(key, value)
      VALUES ('LOCKDOWN_MODE', '{"enabled": false}'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS application_settings`);
    await queryRunner.query(`DROP TABLE IF EXISTS mfa_recovery_codes`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS cell_changes`);
    await queryRunner.query(`DROP TABLE IF EXISTS jobs`);
    await queryRunner.query(`DROP TABLE IF EXISTS worksheets`);
    await queryRunner.query(`DROP TABLE IF EXISTS workbooks`);
    await queryRunner.query(`DROP TABLE IF EXISTS device_enrollment_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS devices`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
