export const USER_ROLES = ["ADMIN", "EMPLOYEE"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DEVICE_STATUSES = ["PENDING", "APPROVED", "REVOKED"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const JOB_STATUSES = [
  "DRAFT",
  "ASSIGNED",
  "IN_PROGRESS",
  "SUBMITTED",
  "LOCKED",
  "ARCHIVED"
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const AUDIT_EVENTS = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "MFA_SUCCESS",
  "MFA_FAILED",
  "SESSION_EXPIRED",
  "DEVICE_ENROLLMENT_REQUESTED",
  "DEVICE_APPROVED",
  "DEVICE_REVOKED",
  "DEVICE_REJECTED",
  "DEVICE_SESSION_MISMATCH",
  "WORKBOOK_UPLOADED",
  "WORKBOOK_DELETED",
  "JOB_CREATED",
  "JOB_ASSIGNED",
  "JOB_OPENED",
  "JOB_STARTED",
  "JOB_PERMISSION_UPDATED",
  "CELL_MODIFIED",
  "JOB_SUBMITTED",
  "JOB_LOCKED",
  "COPY_ATTEMPT",
  "CUT_ATTEMPT",
  "CONTEXT_MENU_ATTEMPT",
  "PRINT_ATTEMPT",
  "SCREENSHOT_SIGNAL",
  "DOWNLOAD_ATTEMPT",
  "EXPORT_ATTEMPT",
  "UNAUTHORIZED_ACCESS",
  "RATE_LIMIT_TRIGGERED",
  "ADMIN_DOWNLOAD_ORIGINAL",
  "ADMIN_DOWNLOAD_RESULT",
  "LOCKDOWN_ENABLED",
  "LOCKDOWN_DISABLED"
] as const;
export type AuditEventType = (typeof AUDIT_EVENTS)[number];

export const SECURITY_ALERT_EVENTS = [
  "DEVICE_REJECTED",
  "DEVICE_SESSION_MISMATCH",
  "COPY_ATTEMPT",
  "CUT_ATTEMPT",
  "CONTEXT_MENU_ATTEMPT",
  "PRINT_ATTEMPT",
  "SCREENSHOT_SIGNAL",
  "DOWNLOAD_ATTEMPT",
  "EXPORT_ATTEMPT",
  "RATE_LIMIT_TRIGGERED",
  "UNAUTHORIZED_ACCESS"
] as const satisfies readonly AuditEventType[];
export type SecurityAlertEventType = (typeof SECURITY_ALERT_EVENTS)[number];

export const ERROR_CODES = [
  "AUTH_INVALID",
  "AUTH_LOCKED",
  "MFA_REQUIRED",
  "MFA_INVALID",
  "DEVICE_REQUIRED",
  "DEVICE_PENDING",
  "DEVICE_NOT_APPROVED",
  "DEVICE_REVOKED",
  "DEVICE_SESSION_MISMATCH",
  "JOB_NOT_ASSIGNED",
  "JOB_LOCKED",
  "JOB_ALREADY_SUBMITTED",
  "DOWNLOAD_FORBIDDEN",
  "EXPORT_FORBIDDEN",
  "UNAUTHORIZED_ACCESS",
  "INVALID_WORKBOOK",
  "INVALID_CELL",
  "RATE_LIMITED",
  "LOCKDOWN_ACTIVE"
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  requestId: string;
}

export interface SessionWatermark {
  userName: string;
  deviceName: string;
  sessionPublicId: string;
  timestamp: string;
}

export interface GridCellDto {
  address: string;
  value: string | number | boolean | null;
  formula: string | null;
  editable: boolean;
  modified: boolean;
}

export interface GridRowDto {
  rowNumber: number;
  cells: GridCellDto[];
}

export interface RowsPageDto {
  sheetId: string;
  start: number;
  limit: number;
  totalRows: number;
  rows: GridRowDto[];
}
