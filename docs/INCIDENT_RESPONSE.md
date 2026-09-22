# Incident Response

## Suspicious Device

1. Enable lockdown from Admin -> Seguridad.
2. Revoke the device.
3. Review audit events for `DEVICE_SESSION_MISMATCH`, `DOWNLOAD_ATTEMPT`, `COPY_ATTEMPT`, `PRINT_ATTEMPT` and `SCREENSHOT_SIGNAL`.
4. Rotate the employee password.
5. Issue a new enrollment token only after validating the PC.

## Audit Chain Alert

If audit verification returns `CADENA ALTERADA`:

1. Preserve database and logs.
2. Stop non-essential access.
3. Export the affected audit range.
4. Compare with PostgreSQL backups.
5. Rotate `AUDIT_HMAC_KEY_FILE` only after preserving evidence.

## Secret Exposure

Rotate affected secrets. If the master key is exposed, treat all encrypted files as compromised and re-encrypt from a trusted backup.
