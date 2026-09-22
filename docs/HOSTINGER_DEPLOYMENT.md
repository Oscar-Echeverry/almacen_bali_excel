# Hostinger Ubuntu Deployment

For the current split deployment, prefer [NETLIFY_LINUX_DEPLOYMENT.md](NETLIFY_LINUX_DEPLOYMENT.md): frontend on Netlify and backend on `excelseguro.duckdns.org`.

Target: Ubuntu 24.04 LTS or current supported LTS. Everything is native; no Docker.

## 1. System Update

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

## 2. Deploy User And SSH

Create a non-root deploy user with SSH keys. After confirming access, disable password login and root SSH login:

```text
PasswordAuthentication no
PermitRootLogin no
```

Reload SSH only after testing a second session.

## 3. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Do not expose `3000`, `5432` or `6379`.

## 4. Native Packages

```bash
sudo scripts/server/bootstrap-ubuntu.sh
```

Install Node.js `24.21.0` LTS using `nvm` or NodeSource. Use the same version for frontend and backend.

## 5. PostgreSQL

Bind PostgreSQL to localhost. Create database and user:

```sql
CREATE DATABASE secure_spreadsheet;
CREATE USER secure_spreadsheet WITH PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE secure_spreadsheet TO secure_spreadsheet;
```

## 6. Redis

Keep Redis bound to `127.0.0.1`. Do not expose port `6379`.

## 7. Directories And Secrets

```bash
sudo scripts/server/generate-secrets.sh
sudo scripts/server/generate-device-ca.sh
```

Create `/etc/secure-spreadsheet/production.env` from `.env.example`. Do not put actual secret values in Git; point to secret files.

## 8. Clone And Build

```bash
sudo mkdir -p /opt/secure-spreadsheet/source
sudo chown deploy:deploy /opt/secure-spreadsheet/source
git clone <repo-url> /opt/secure-spreadsheet/source
cd /opt/secure-spreadsheet/source
npm ci
npm run build
cd apps/backend
npm run migration:run
```

## 9. Frontend

The frontend is published by Netlify. If you need a temporary Linux-hosted frontend for testing, run the deploy script with `DEPLOY_FRONTEND_ON_SERVER=true`.

## 10. systemd And Nginx

```bash
sudo install -m 0644 deploy/systemd/secure-spreadsheet.service /etc/systemd/system/
sudo install -m 0644 deploy/nginx/secure-spreadsheet.conf /etc/nginx/sites-available/secure-spreadsheet
sudo ln -sfn /etc/nginx/sites-available/secure-spreadsheet /etc/nginx/sites-enabled/secure-spreadsheet
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now secure-spreadsheet
sudo systemctl reload nginx
```

## 11. TLS

```bash
sudo certbot --nginx -d excelseguro.duckdns.org
sudo systemctl status certbot.timer
```

## 12. First Admin

```bash
cd /opt/secure-spreadsheet/backend
ADMIN_EMAIL=admin@example.com ADMIN_NAME="Admin" ADMIN_PASSWORD="long-random-password" npm run admin:create
```

## 13. Health And Logs

```bash
curl http://127.0.0.1:3000/api/health
sudo journalctl -u secure-spreadsheet -f
```

## 14. Backups

```bash
sudo install -m 0644 deploy/systemd/secure-spreadsheet-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now secure-spreadsheet-backup.timer
```
