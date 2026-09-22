# Netlify Frontend + Linux Backend

Target:

- Backend API: `https://excelseguro.duckdns.org/api`
- Frontend: any Netlify site URL or custom Netlify domain.

## Frontend On Netlify

Use the repository root as the Netlify base directory. The included `netlify.toml` sets:

```toml
[build]
  command = "npm run build --workspace @secure-spreadsheet/shared && npm run build --workspace @secure-spreadsheet/frontend"
  publish = "apps/frontend/dist"
```

Set this Netlify environment variable if you override the file value:

```env
VITE_API_BASE_URL=https://excelseguro.duckdns.org/api
```

Frontend URL: `https://almacenlasbalinerasexcel.netlify.app`.

## Backend On Linux

Point the DuckDNS DNS record for `excelseguro.duckdns.org` to the server public IP.

Create `/etc/secure-spreadsheet/production.env` from `.env.example` and set the final Netlify origin exactly:

```env
NODE_ENV=production
APP_URL=https://almacenlasbalinerasexcel.netlify.app
API_URL=https://excelseguro.duckdns.org/api
FRONTEND_ORIGIN=https://almacenlasbalinerasexcel.netlify.app
FRONTEND_ORIGINS=
TRUST_PROXY=true
SESSION_COOKIE_SAME_SITE=none
DEVICE_SECURITY_MODE=browser
```

`FRONTEND_ORIGIN` must not end with `/`. If you later add a custom Netlify domain, add it to `FRONTEND_ORIGINS` as a comma-separated value and restart the backend.

Install packages and directories:

```bash
sudo scripts/server/bootstrap-ubuntu.sh
```

Generate secrets. The device CA is only needed if you switch back to `DEVICE_SECURITY_MODE=mtls`:

```bash
sudo scripts/server/generate-secrets.sh
```

Issue TLS for the backend domain:

```bash
sudo certbot --nginx -d excelseguro.duckdns.org
```

Deploy backend:

```bash
sudo /opt/secure-spreadsheet/scripts/deploy.sh
```

The deploy script builds and publishes the backend only. To also publish the frontend to the Linux server for testing, run it with `DEPLOY_FRONTEND_ON_SERVER=true`.

## Important

The browser should call `https://excelseguro.duckdns.org/api` directly.

With `DEVICE_SECURITY_MODE=browser`, employees do not install certificates. On the first login from a new browser, the backend creates a pending device. The admin approves it in `Dispositivos`, then the employee logs in again from that same browser.
