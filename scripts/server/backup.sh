#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/opt/secure-spreadsheet/backups}"
STORAGE_DIR="${STORAGE_DIR:-/opt/secure-spreadsheet/storage}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_DIR="${BACKUP_ROOT}/${STAMP}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

install -d -m 0700 "$TARGET_DIR"
pg_dump "$DATABASE_URL" --format=custom --file "$TARGET_DIR/postgres.dump"
tar -C "$(dirname "$STORAGE_DIR")" -czf "$TARGET_DIR/storage.tar.gz" "$(basename "$STORAGE_DIR")"

if [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  gpg --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$TARGET_DIR/postgres.dump"
  rm -f "$TARGET_DIR/postgres.dump"
fi

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -print -exec rm -rf {} \;
echo "Backup completed at $TARGET_DIR"
