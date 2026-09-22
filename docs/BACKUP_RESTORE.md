# Backup And Restore

`scripts/server/backup.sh` creates:

- PostgreSQL custom dump
- encrypted storage tarball

Secrets are not included by default. Store secrets separately in a secure password manager or offline vault.

Run:

```bash
sudo systemctl start secure-spreadsheet-backup.service
```

Optional GPG encryption for PostgreSQL dump:

```bash
BACKUP_GPG_RECIPIENT=ops@example.com scripts/server/backup.sh
```

Restore:

```bash
sudo DATABASE_URL=postgres://... scripts/server/restore.sh /opt/secure-spreadsheet/backups/20260919T021500Z
```

Local backups are not enough for disaster recovery. Copy backups offsite.
