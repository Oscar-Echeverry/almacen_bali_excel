#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: restore.sh /opt/secure-spreadsheet/backups/<timestamp>" >&2
  exit 1
fi

BACKUP_DIR="$1"
STORAGE_DIR="${STORAGE_DIR:-/opt/secure-spreadsheet/storage}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

echo "This will restore database and encrypted storage from: $BACKUP_DIR"
read -r -p "Continue? [y/N] " answer
if [[ "${answer}" != "y" && "${answer}" != "Y" ]]; then
  exit 0
fi

systemctl stop secure-spreadsheet || true
pg_restore --clean --if-exists --dbname "$DATABASE_URL" "$BACKUP_DIR/postgres.dump"
rm -rf "$STORAGE_DIR"
tar -C "$(dirname "$STORAGE_DIR")" -xzf "$BACKUP_DIR/storage.tar.gz"
chown -R securesheet:securesheet "$STORAGE_DIR"
chmod -R go-rwx "$STORAGE_DIR"
systemctl start secure-spreadsheet
echo "Restore completed."
