#!/usr/bin/env bash
set -euo pipefail

SECRETS_DIR="${SECRETS_DIR:-/opt/secure-spreadsheet/secrets}"
OWNER="${OWNER:-root:securesheet}"

install -d -m 0750 -o root -g securesheet "$SECRETS_DIR"

create_secret() {
  local name="$1"
  local bytes="$2"
  local path="${SECRETS_DIR}/${name}"
  if [[ -e "$path" ]]; then
    echo "exists: $path"
    return
  fi
  openssl rand -base64 "$bytes" > "$path"
  chown "$OWNER" "$path"
  chmod 0640 "$path"
  echo "created: $path"
}

create_secret session.key 48
create_secret master.key 64
create_secret audit-hmac.key 64
