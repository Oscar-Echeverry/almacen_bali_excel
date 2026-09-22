# Security

## Device Identity

Employee access requires username/password plus an approved client certificate. IP address, User-Agent and browser fingerprints are audit metadata only; they are not device identity.

Nginx terminates TLS and mTLS, then overwrites:

- `X-Client-Verify`
- `X-Client-Fingerprint`
- `X-Client-DN`

The backend trusts those headers only from the local Nginx reverse proxy.

## Sessions

Sessions are server-side and stored in Redis in production. Cookies are `HttpOnly`, `Secure` and `SameSite=Strict`. Authentication data is never stored in `localStorage`.

## Encryption

Workbook files use AES-256-GCM with a unique DEK and IV per file. The DEK is encrypted with a master key read from `MASTER_ENCRYPTION_KEY_FILE`. Master keys, CA keys and session secrets must stay outside Git.

## Audit Integrity

Each audit event stores `previous_hash` and `hash`, where `hash = HMAC(previous_hash + canonical_payload)`. This is tamper-evident logging, not blockchain.

## Browser Reality

A web application cannot fully prevent someone who can see information from transcribing, photographing, memorizing, using malware, recording the screen or using another camera.

The system reduces digital exfiltration by:

- never sending XLSX to employees
- requiring approved devices
- server-side pagination
- no export endpoints
- copy/print/context-menu dissuasion
- visible repeated dynamic watermark
- audit logs for observable restricted actions

For the highest assurance, use corporate-managed PCs where employees are not local administrators.
