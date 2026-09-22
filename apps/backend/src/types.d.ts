import type { UserRole } from "@secure-spreadsheet/shared";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: UserRole;
    deviceId?: string;
    deviceFingerprint?: string;
    sessionPublicId?: string;
    csrfSecret?: string;
    lastSeenAt?: number;
    mfaPendingUserId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}
