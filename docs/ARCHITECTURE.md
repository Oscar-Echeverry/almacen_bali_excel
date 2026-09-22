# Architecture

Secure Spreadsheet Workspace is a modular monolith.

```text
Internet -> HTTPS Nginx -> React static files
                       -> /api -> NestJS on 127.0.0.1:3000
NestJS -> PostgreSQL
NestJS -> Redis
NestJS -> /opt/secure-spreadsheet/storage encrypted files
```

## Backend Modules

- Auth: Argon2id passwords, server-side sessions, CSRF, session rotation.
- Devices: mTLS fingerprint binding, enrollment tokens, approval and revocation.
- Excel: upload validation, encrypted storage, worksheet metadata, paginated row API, deltas and final result generation.
- Audit: HMAC-SHA256 tamper-evident chain.
- Security: Redis rate limiting, lockdown setting and health checks.

## Data Flow

The employee never downloads the workbook. The server decrypts the original only in process memory, reads the requested sheet/row window, applies current deltas and returns only the requested cells.

Final submission decrypts the original, applies last deltas, writes a result workbook, encrypts it immediately and stores only `result.enc`.
