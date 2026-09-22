#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root on the Ubuntu VPS." >&2
  exit 1
fi

if ! grep -qi ubuntu /etc/os-release; then
  echo "This script is intended for Ubuntu LTS." >&2
  exit 1
fi

echo "This installs native packages only. It does not create database passwords."
read -r -p "Continue? [y/N] " answer
if [[ "${answer}" != "y" && "${answer}" != "Y" ]]; then
  exit 0
fi

apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl git gnupg nginx postgresql postgresql-contrib redis-server ufw certbot python3-certbot-nginx openssl rsync gpg

if ! id securesheet >/dev/null 2>&1; then
  useradd --system --home /opt/secure-spreadsheet --shell /usr/sbin/nologin securesheet
fi

mkdir -p /opt/secure-spreadsheet/{backend,storage,secrets,scripts,backups,tmp}
mkdir -p /opt/secure-spreadsheet/backend/packages/shared
mkdir -p /var/www/secure-spreadsheet/frontend
mkdir -p /etc/secure-spreadsheet
chown -R securesheet:securesheet /opt/secure-spreadsheet/storage /opt/secure-spreadsheet/tmp
chown -R root:securesheet /opt/secure-spreadsheet/secrets /etc/secure-spreadsheet
chmod 750 /opt/secure-spreadsheet/secrets /etc/secure-spreadsheet
chmod 700 /opt/secure-spreadsheet/storage /opt/secure-spreadsheet/tmp

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
echo "Enable UFW after confirming SSH access: ufw enable"

systemctl enable --now postgresql redis-server nginx
echo "Bootstrap complete. Configure Node.js 24 LTS, PostgreSQL user/database, secrets, production.env, then run deploy.sh."
