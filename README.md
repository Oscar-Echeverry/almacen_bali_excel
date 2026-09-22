# Secure Spreadsheet Workspace

Private web workspace for highly confidential `.xlsx` files. Employees edit only server-rendered cell data through a paginated API; the browser never receives the original workbook.

## Architecture

- Ubuntu VPS, Nginx, PostgreSQL, Redis and systemd installed natively.
- Backend: NestJS + TypeScript, listening on `127.0.0.1:3000`.
- Frontend: React + Vite build published to Netlify.
- Files: encrypted AES-256-GCM under `/opt/secure-spreadsheet/storage`.
- Device trust: employees can be approved by browser device token, with optional mTLS support for stricter deployments.

No Docker, Docker Compose, Podman, Kubernetes or containers are used.

## Development

Use Node.js from `.nvmrc`:

```bash
nvm use
npm install
npm run build --workspace @secure-spreadsheet/shared
npm run lint
npm run test
```

Local development can use:

```env
DEVICE_SECURITY_MODE=development
```

Production must use:

```env
NODE_ENV=production
DEVICE_SECURITY_MODE=browser
```

The backend refuses to start in production if required secret files are missing.

## Database And Redis

PostgreSQL and Redis are native services. Create a dedicated database and user:

```sql
CREATE DATABASE secure_spreadsheet;
CREATE USER secure_spreadsheet WITH PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE secure_spreadsheet TO secure_spreadsheet;
```

Run migrations from `apps/backend`:

```bash
npm run migration:run
```

Do not enable TypeORM `synchronize` in production.

## First Admin

After building backend and running migrations:

```bash
cd /opt/secure-spreadsheet/backend
ADMIN_EMAIL=admin@example.com ADMIN_NAME="Admin" ADMIN_PASSWORD="use-a-long-secret" npm run admin:create
```

No production admin password is hardcoded.

## Device Enrollment

1. Admin creates an employee.
2. Employee attempts login from their browser.
3. The backend creates a `PENDING` device for that browser.
4. Admin approves the device in `Dispositivos`.
5. Employee logs in again from the same browser.

## Deployment

See [docs/NETLIFY_LINUX_DEPLOYMENT.md](docs/NETLIFY_LINUX_DEPLOYMENT.md). The backend production domain is `https://excelseguro.duckdns.org`; the frontend is built for Netlify through `netlify.toml`.

Main production command:

```bash
sudo /opt/secure-spreadsheet/scripts/deploy.sh
```

## Backups

See [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md). Backups include PostgreSQL and encrypted storage. Secrets are not included by default.

## Tests

```bash
npm run lint
npm run test
npm run build
```

Production-only checks such as `nginx -t`, `systemctl status`, PostgreSQL exposure and Redis exposure must be run on the VPS.
