# Operations

## Service

```bash
sudo systemctl status secure-spreadsheet
sudo journalctl -u secure-spreadsheet -f
sudo systemctl restart secure-spreadsheet
```

## Deploy

```bash
sudo /opt/secure-spreadsheet/scripts/deploy.sh
```

The deploy script installs dependencies, builds the backend, runs migrations, tests Nginx config, restarts backend and checks health. The frontend is built by Netlify; set `DEPLOY_FRONTEND_ON_SERVER=true` only for a temporary Linux-hosted frontend.

## PostgreSQL

Keep PostgreSQL on localhost. Review:

```bash
ss -ltnp | grep 5432
```

## Redis

Keep Redis on localhost:

```bash
redis-cli -h 127.0.0.1 ping
ss -ltnp | grep 6379
```

## Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```
