# Device Approval

Production uses browser device approval by default:

```env
DEVICE_SECURITY_MODE=browser
```

Flow:

1. Admin creates the employee user.
2. Employee tries to log in from their normal browser.
3. The login is rejected with `Dispositivo pendiente de aprobacion`.
4. Admin opens `Dispositivos` and approves the pending device.
5. Employee logs in again from the same browser.

The browser stores a private random device token in local storage. Clearing browser data or using another browser creates a new pending device.

The legacy `scripts/windows/enroll-device.ps1` flow is only needed for stricter mTLS deployments.
