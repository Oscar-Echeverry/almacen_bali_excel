# Device Enrollment

Admin generates a device enrollment token for an employee. The token is cryptographically random, single-use and expires after `ENROLLMENT_TOKEN_TTL_MINUTES`, default 15 minutes.

On the employee PC:

```powershell
.\scripts\windows\enroll-device.ps1 -BaseUrl https://excelseguro.duckdns.org
```

The script:

1. Generates a non-exportable Windows private key when supported by the provider.
2. Generates a CSR.
3. Sends the CSR and token to `/api/enrollment/submit`.
4. Receives the signed client certificate.
5. Installs it into the Windows Certificate Store.

The private key is not uploaded and is not written as plaintext.

After enrollment the device is `PENDING`. An admin must approve it before employee login works.
