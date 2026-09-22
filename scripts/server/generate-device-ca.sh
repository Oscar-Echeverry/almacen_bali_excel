#!/usr/bin/env bash
set -euo pipefail

SECRETS_DIR="${SECRETS_DIR:-/opt/secure-spreadsheet/secrets}"
CA_KEY="${SECRETS_DIR}/device-ca.key"
CA_CERT="${SECRETS_DIR}/device-ca.crt"

install -d -m 0750 -o root -g securesheet "$SECRETS_DIR"

if [[ -e "$CA_KEY" || -e "$CA_CERT" ]]; then
  echo "CA files already exist. Refusing to overwrite." >&2
  exit 1
fi

openssl genrsa -out "$CA_KEY" 4096
openssl req -x509 -new -nodes -key "$CA_KEY" -sha256 -days 3650 \
  -subj "/CN=Secure Spreadsheet Workspace Device CA/O=Internal" \
  -out "$CA_CERT"

chown root:securesheet "$CA_KEY" "$CA_CERT"
chmod 0640 "$CA_KEY"
chmod 0644 "$CA_CERT"
echo "Device CA created. Keep ${CA_KEY} private and out of Git."
