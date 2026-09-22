import type { AuditEventType, RowsPageDto } from "@secure-spreadsheet/shared";

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = configuredApiBase ? configuredApiBase.replace(/\/+$/, "") : "/api";

export interface UserSession {
  id: string;
  email?: string;
  name?: string;
  role: "ADMIN" | "EMPLOYEE";
  sessionPublicId: string;
  deviceId: string | null;
}

export interface DashboardStats {
  activeJobs: number;
  submittedJobs: number;
  activeEmployees: number;
  pendingDevices: number;
  revokedDevices: number;
  securityEvents24h: number;
  failedLogins: number;
  copyAttempts: number;
  printAttempts: number;
  rejectedDevices: number;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "EMPLOYEE";
  active: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
}

export interface DeviceRow {
  id: string;
  name: string;
  userId: string;
  user?: { email: string; name: string };
  certificateFingerprint: string;
  status: "PENDING" | "APPROVED" | "REVOKED";
  createdAt: string;
  approvedAt: string | null;
  revokedAt: string | null;
  lastSeenAt: string | null;
  lastIp: string | null;
}

export interface WorkbookRow {
  id: string;
  originalFilename: string;
  sizeBytes: string;
  status: string;
  createdAt: string;
  worksheets: Array<{ id: string; name: string; rowCount: number; columnCount: number; columnWidths?: Array<number | null> }>;
}

export interface JobRow {
  id: string;
  workbookId: string;
  workbookName: string;
  worksheets: Array<{ id: string; name: string; rowCount: number; columnCount: number; columnWidths?: Array<number | null> }>;
  assignedUserId: string;
  status: string;
  allowFormulaEditing: boolean;
  editEnabled: boolean;
  viewAccessEnabled: boolean;
  createdAt: string;
  submittedAt: string | null;
}

export interface AuditRow {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  userId: string | null;
  deviceId: string | null;
  ip: string | null;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
}

export interface NotificationRow {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

let csrfToken: string | null = null;

export async function ensureCsrf(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include" });
  const body = await response.json() as { csrfToken: string };
  csrfToken = body.csrfToken;
  return csrfToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers);
  if (method !== "GET") {
    headers.set("X-CSRF-Token", await ensureCsrf());
  }
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include"
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: "Error de red" })) as { message?: string; code?: string };
    if (response.status === 401 && typeof window !== "undefined") {
      csrfToken = null;
      window.dispatchEvent(new CustomEvent("session-invalid", { detail: errorBody.message ?? "Sesión cerrada." }));
    }
    throw new Error(errorBody.message ?? errorBody.code ?? "Solicitud fallida");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string, mfaCode?: string) =>
    request<UserSession>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, mfaCode }) }),
  me: () => request<UserSession>("/auth/me"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  dashboard: () => request<DashboardStats>("/admin/dashboard"),
  users: () => request<UserRow[]>("/admin/users"),
  createUser: (payload: { email: string; name: string; password: string; role: "ADMIN" | "EMPLOYEE" }) =>
    request<UserRow>("/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  devices: () => request<DeviceRow[]>("/admin/devices"),
  createEnrollmentToken: (userId: string) =>
    request<{ token: string; expiresAt: string }>("/admin/devices/enrollment-token", { method: "POST", body: JSON.stringify({ userId }) }),
  approveDevice: (id: string) => request<DeviceRow>(`/admin/devices/${id}/approve`, { method: "POST" }),
  revokeDevice: (id: string) => request<DeviceRow>(`/admin/devices/${id}/revoke`, { method: "POST" }),
  workbooks: () => request<WorkbookRow[]>("/admin/workbooks"),
  uploadWorkbook: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<WorkbookRow>("/admin/workbooks", { method: "POST", body: form });
  },
  deleteWorkbook: (id: string) => request<{ ok: true }>(`/admin/workbooks/${id}`, { method: "DELETE" }),
  jobsAdmin: () => request<JobRow[]>("/admin/jobs"),
  createJob: (payload: { workbookId: string; assignedUserId: string; allowFormulaEditing: boolean; editEnabled: boolean; viewAccessEnabled: boolean }) =>
    request<JobRow>("/admin/jobs", { method: "POST", body: JSON.stringify(payload) }),
  deleteJob: (id: string) => request<{ ok: true }>(`/admin/jobs/${id}`, { method: "DELETE" }),
  updateJobPermissions: (id: string, payload: { editEnabled?: boolean; allowFormulaEditing?: boolean; viewAccessEnabled?: boolean }) =>
    request<JobRow>(`/admin/jobs/${id}/permissions`, { method: "PATCH", body: JSON.stringify(payload) }),
  lockJob: (id: string) => request<JobRow>(`/admin/jobs/${id}/lock`, { method: "POST" }),
  changes: (jobId: string) => request<unknown[]>(`/admin/jobs/${jobId}/changes`),
  audit: (scope: "all" | "security" = "all") => request<AuditRow[]>(`/admin/audit${scope === "security" ? "?scope=security" : ""}`),
  verifyAudit: () => request<{ ok: boolean; message: string; checked: number; brokenAt: string | null }>("/admin/audit/verify"),
  lockdown: () => request<{ enabled: boolean }>("/admin/security/lockdown"),
  setLockdown: (enabled: boolean) => request<{ enabled: boolean }>(`/admin/security/lockdown/${enabled ? "enable" : "disable"}`, { method: "POST" }),
  jobs: () => request<JobRow[]>("/jobs"),
  rows: (jobId: string, sheetId: string, start: number, limit: number, workspaceToken: string) =>
    request<RowsPageDto>(`/jobs/${jobId}/sheets/${sheetId}/rows?start=${start}&limit=${limit}`, { headers: { "X-Workspace-Token": workspaceToken } }),
  patchCells: (jobId: string, changes: Array<{ worksheetId: string; cellAddress: string; newValue: string | number | boolean | null }>, workspaceToken: string) =>
    request<{ saved: number }>(`/jobs/${jobId}/cells`, { method: "PATCH", headers: { "X-Workspace-Token": workspaceToken }, body: JSON.stringify({ changes }) }),
  submitJob: (jobId: string, workspaceToken: string) =>
    request<JobRow>(`/jobs/${jobId}/submit`, { method: "POST", headers: { "X-Workspace-Token": workspaceToken } }),
  heartbeatJob: (jobId: string, workspaceToken: string) =>
    request<{ ok: true }>(`/jobs/${jobId}/heartbeat`, { method: "POST", headers: { "X-Workspace-Token": workspaceToken } }),
  releaseJob: (jobId: string, workspaceToken: string) =>
    request<{ ok: true }>(`/jobs/${jobId}/release`, { method: "POST", headers: { "X-Workspace-Token": workspaceToken } }),
  recordSecurityEvent: (eventType: AuditEventType, resourceType?: string, resourceId?: string) =>
    request<{ ok: true }>("/security-events", { method: "POST", body: JSON.stringify({ eventType, resourceType, resourceId }) }),
  unreadNotifications: () => request<NotificationRow[]>("/admin/notifications/unread"),
  markNotificationsRead: () => request<{ ok: true }>("/admin/notifications/read-all", { method: "POST" })
};
