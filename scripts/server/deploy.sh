#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/secure-spreadsheet}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/source}"
BACKEND_DIR="$REPO_DIR/apps/backend"
FRONTEND_DIR="$REPO_DIR/apps/frontend"
FRONTEND_TARGET="/var/www/secure-spreadsheet/frontend"
DEPLOY_FRONTEND_ON_SERVER="${DEPLOY_FRONTEND_ON_SERVER:-false}"

cd "$REPO_DIR"

if [[ "${SKIP_GIT_PULL:-false}" != "true" ]]; then
  git pull --ff-only
fi

npm ci
npm run build --workspace @secure-spreadsheet/shared
npm run lint --workspace @secure-spreadsheet/backend
npm run build --workspace @secure-spreadsheet/backend

if [[ "$DEPLOY_FRONTEND_ON_SERVER" == "true" ]]; then
  npm run lint --workspace @secure-spreadsheet/frontend
  npm run build --workspace @secure-spreadsheet/frontend
fi

cd "$BACKEND_DIR"
npm run migration:run

rsync -a --delete "$BACKEND_DIR/dist/" "$APP_ROOT/backend/dist/"
rsync -a --delete "$BACKEND_DIR/package.json" "$APP_ROOT/backend/package.json"
rsync -a --delete "$REPO_DIR/node_modules/" "$APP_ROOT/backend/node_modules/"
mkdir -p "$APP_ROOT/backend/packages/shared"
rsync -a --delete "$REPO_DIR/packages/shared/" "$APP_ROOT/backend/packages/shared/"
if [[ "$DEPLOY_FRONTEND_ON_SERVER" == "true" ]]; then
  rsync -a --delete "$FRONTEND_DIR/dist/" "$FRONTEND_TARGET/"
fi
rsync -a "$REPO_DIR/scripts/server/" "$APP_ROOT/scripts/"

install -m 0644 "$REPO_DIR/deploy/systemd/secure-spreadsheet.service" /etc/systemd/system/secure-spreadsheet.service
install -m 0644 "$REPO_DIR/deploy/systemd/secure-spreadsheet-backup.service" /etc/systemd/system/secure-spreadsheet-backup.service
install -m 0644 "$REPO_DIR/deploy/systemd/secure-spreadsheet-backup.timer" /etc/systemd/system/secure-spreadsheet-backup.timer
install -m 0644 "$REPO_DIR/deploy/nginx/secure-spreadsheet.conf" /etc/nginx/sites-available/secure-spreadsheet
ln -sfn /etc/nginx/sites-available/secure-spreadsheet /etc/nginx/sites-enabled/secure-spreadsheet

nginx -t
systemctl daemon-reload
systemctl enable secure-spreadsheet
systemctl restart secure-spreadsheet
systemctl reload nginx

curl --fail --silent --show-error http://127.0.0.1:3000/api/health
echo
echo "Deploy complete."
