# mTLS

The internal device CA lives outside Git:

```text
/opt/secure-spreadsheet/secrets/device-ca.key
/opt/secure-spreadsheet/secrets/device-ca.crt
```

The private key must be readable only by root and the backend service group if CSR signing is enabled:

```bash
chmod 640 /opt/secure-spreadsheet/secrets/device-ca.key
chown root:securesheet /opt/secure-spreadsheet/secrets/device-ca.key
```

Nginx uses:

```nginx
ssl_client_certificate /opt/secure-spreadsheet/secrets/device-ca.crt;
ssl_verify_client optional;
```

Routes can remain reachable for login/admin while employee API calls are rejected by backend guards unless `X-Client-Verify=SUCCESS` and the certificate fingerprint matches an approved device.
