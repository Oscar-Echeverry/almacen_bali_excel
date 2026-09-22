import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Pencil, RotateCw, ShieldAlert, Trash2, Upload, UserX, X } from "lucide-react";
import type { AuditEventType } from "@secure-spreadsheet/shared";
import { api, AuditRow, DeviceRow, JobRow, UserRow, WorkbookRow } from "../api/client";

function useLoad<T>(loader: () => Promise<T>, initial: T): [T, string, () => Promise<void>] {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const reload = async () => {
    try {
      setData(await loader());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos.");
    }
  };
  useEffect(() => {
    void reload();
  }, []);
  return [data, error, reload];
}

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  EMPLOYEE: "Empleado"
};

const deviceStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REVOKED: "Revocado"
};

const jobStatusLabels: Record<string, string> = {
  ASSIGNED: "Asignado",
  IN_PROGRESS: "En edición",
  SUBMITTED: "Enviado",
  LOCKED: "Bloqueado",
  ARCHIVED: "Archivado"
};

const eventLabels: Record<string, string> = {
  LOGIN_SUCCESS: "Inicio de sesión",
  LOGIN_FAILED: "Ingreso fallido",
  LOGOUT: "Cierre de sesión",
  DEVICE_APPROVED: "Dispositivo aprobado",
  DEVICE_REVOKED: "Dispositivo revocado",
  DEVICE_REJECTED: "Dispositivo rechazado",
  DEVICE_SESSION_MISMATCH: "Dispositivo no coincide",
  WORKBOOK_UPLOADED: "Archivo subido",
  JOB_CREATED: "Archivo asignado",
  JOB_ASSIGNED: "Asignación creada",
  JOB_OPENED: "Archivo abierto",
  JOB_PERMISSION_UPDATED: "Permiso cambiado",
  CELL_MODIFIED: "Celda editada",
  JOB_SUBMITTED: "Trabajo enviado",
  JOB_LOCKED: "Trabajo bloqueado",
  COPY_ATTEMPT: "Intento de copiar",
  CUT_ATTEMPT: "Intento de cortar",
  CONTEXT_MENU_ATTEMPT: "Intento de clic derecho",
  PRINT_ATTEMPT: "Intento de imprimir",
  SCREENSHOT_SIGNAL: "Intento de captura",
  DOWNLOAD_ATTEMPT: "Intento de descarga",
  EXPORT_ATTEMPT: "Intento de exportar",
  UNAUTHORIZED_ACCESS: "Acceso no autorizado",
  RATE_LIMIT_TRIGGERED: "Límite activado",
  ADMIN_DOWNLOAD_ORIGINAL: "Admin descargó original",
  ADMIN_DOWNLOAD_RESULT: "Admin descargó resultado",
  LOCKDOWN_ENABLED: "Emergencia activada",
  LOCKDOWN_DISABLED: "Emergencia desactivada"
};

const SECURITY_ALERT_EVENTS: readonly AuditEventType[] = [
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
];

const highlightedEvents = new Set<string>(SECURITY_ALERT_EVENTS);

const metadataKeyLabels: Record<string, string> = {
  reason: "Motivo",
  fingerprint: "Huella",
  count: "Cantidad"
};

const metadataValueLabels: Record<string, string> = {
  already_open_elsewhere: "Archivo abierto en otra pestaña o navegador",
  edit_disabled: "Edición deshabilitada",
  view_access_disabled: "Acceso retirado por el administrador",
  missing_workspace_token: "Pestaña no validada",
  locked: "Usuario bloqueado",
  true: "Sí",
  false: "No"
};

export function UsersPage(): JSX.Element {
  const [users, error, reload] = useLoad<UserRow[]>(() => api.users(), []);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "EMPLOYEE" as "ADMIN" | "EMPLOYEE" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api.createUser(form);
    setForm({ email: "", name: "", password: "", role: "EMPLOYEE" });
    await reload();
  };

  return (
    <section>
      <header className="page-header"><h1>Crear usuarios</h1></header>
      {error && <p className="form-error">{error}</p>}
      <form className="inline-form" onSubmit={submit}>
        <label>
          Correo
          <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" required />
        </label>
        <label>
          Nombre
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          Contraseña temporal
          <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" minLength={12} required />
        </label>
        <label>
          Rol
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "ADMIN" | "EMPLOYEE" })}>
            <option value="EMPLOYEE">Empleado</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>
        <button className="primary-button" type="submit">Crear usuario</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Correo</th><th>Nombre</th><th>Rol</th><th>Activo</th><th>Último ingreso</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.name}</td>
                <td>{roleLabels[user.role]}</td>
                <td>{user.active ? "Sí" : "No"}</td>
                <td>{formatDate(user.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DevicesPage(): JSX.Element {
  const [devices, error, reload] = useLoad<DeviceRow[]>(() => api.devices(), []);
  return (
    <section>
      <header className="page-header"><h1>Dispositivos</h1></header>
      {error && <p className="form-error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Usuario</th><th>Equipo</th><th>Huella</th><th>Estado</th><th>Último acceso</th><th>IP</th><th>Acciones</th></tr></thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>{device.user ? `${device.user.name} (${device.user.email})` : device.userId}</td>
                <td>{device.name}</td>
                <td className="mono">{device.certificateFingerprint.slice(0, 24)}...</td>
                <td>{deviceStatusLabels[device.status]}</td>
                <td>{formatDate(device.lastSeenAt)}</td>
                <td>{device.lastIp ?? "-"}</td>
                <td className="row-actions">
                  <button title="Aprobar dispositivo" onClick={() => api.approveDevice(device.id).then(reload)}><Check size={16} /></button>
                  <button title="Revocar dispositivo" onClick={() => api.revokeDevice(device.id).then(reload)}><X size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FilesPage(): JSX.Element {
  const [workbooks, workbookError, reloadWorkbooks] = useLoad<WorkbookRow[]>(() => api.workbooks(), []);
  const [jobs, jobsError, reloadJobs] = useLoad<JobRow[]>(() => api.jobsAdmin(), []);
  const [users, usersError] = useLoad<UserRow[]>(() => api.users(), []);
  const [selectedWorkbook, setSelectedWorkbook] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const error = workbookError || jobsError || usersError;

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await api.uploadWorkbook(file);
    event.target.value = "";
    await reloadWorkbooks();
  };

  const createJob = async () => {
    if (!selectedWorkbook || !assignedUserId) {
      return;
    }
    await api.createJob({ workbookId: selectedWorkbook, assignedUserId, allowFormulaEditing: false, editEnabled, viewAccessEnabled: true });
    setSelectedWorkbook("");
    setAssignedUserId("");
    setEditEnabled(true);
    await reloadJobs();
  };

  const toggleEdit = async (job: JobRow) => {
    await api.updateJobPermissions(job.id, { editEnabled: !job.editEnabled });
    await reloadJobs();
  };

  const toggleViewAccess = async (job: JobRow) => {
    await api.updateJobPermissions(job.id, { viewAccessEnabled: !job.viewAccessEnabled });
    await reloadJobs();
  };

  const deleteJob = async (job: JobRow) => {
    const userLabel = userById.get(job.assignedUserId)?.email ?? job.assignedUserId;
    if (!window.confirm(`¿Eliminar el acceso de ${userLabel} a ${job.workbookName}? También se eliminarán sus cambios guardados para esta asignación.`)) {
      return;
    }
    await api.deleteJob(job.id);
    await reloadJobs();
  };

  const deleteWorkbook = async (workbook: WorkbookRow) => {
    if (!window.confirm(`¿Eliminar ${workbook.originalFilename}? También se eliminarán sus asignaciones y cambios guardados.`)) {
      return;
    }
    await api.deleteWorkbook(workbook.id);
    await Promise.all([reloadWorkbooks(), reloadJobs()]);
  };

  return (
    <section>
      <header className="page-header">
        <h1>Archivos</h1>
        <label className="upload-button"><Upload size={17} />Subir Excel<input type="file" accept=".xlsx" onChange={upload} /></label>
      </header>
      {error && <p className="form-error">{error}</p>}
      <div className="inline-form">
        <label>
          Archivo
          <select value={selectedWorkbook} onChange={(event) => setSelectedWorkbook(event.target.value)}>
            <option value="">Seleccione un archivo</option>
            {workbooks.map((workbook) => <option key={workbook.id} value={workbook.id}>{workbook.originalFilename}</option>)}
          </select>
        </label>
        <label>
          Empleado
          <select value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
            <option value="">Seleccione un empleado</option>
            {users.filter((user) => user.role === "EMPLOYEE").map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}
          </select>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={editEnabled} onChange={(event) => setEditEnabled(event.target.checked)} />
          Puede editar
        </label>
        <button className="primary-button" onClick={createJob} type="button">Asignar archivo</button>
      </div>

      <div className="file-grid">
        {workbooks.map((workbook) => (
          <article className="file-card" key={workbook.id}>
            <div className="file-card-header">
              <h2>{workbook.originalFilename}</h2>
              <button className="danger-icon" title="Eliminar documento" type="button" onClick={() => deleteWorkbook(workbook)}>
                <Trash2 size={16} />
              </button>
            </div>
            <p>{Number(workbook.sizeBytes).toLocaleString("es-CO")} bytes</p>
            <p>{workbook.worksheets.map((sheet) => sheet.name).join(", ")}</p>
          </article>
        ))}
      </div>

      <h2 className="section-title">Permisos de archivos</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Archivo</th><th>Empleado</th><th>Permiso</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.workbookName}</td>
                <td>{userById.get(job.assignedUserId)?.email ?? job.assignedUserId}</td>
                <td>
                  <span className={!job.viewAccessEnabled ? "permission-pill denied" : job.editEnabled ? "permission-pill edit" : "permission-pill view"}>
                    {!job.viewAccessEnabled ? "Sin acceso" : job.editEnabled ? "Puede editar" : "Solo ver"}
                  </span>
                </td>
                <td>{jobStatusLabels[job.status] ?? job.status}</td>
                <td>{formatDate(job.createdAt)}</td>
                <td className="row-actions">
                  <button title={job.viewAccessEnabled ? "Quitar acceso" : "Restaurar acceso"} onClick={() => toggleViewAccess(job)}>
                    {job.viewAccessEnabled ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button disabled={!job.viewAccessEnabled} title={job.editEnabled ? "Pasar a solo lectura" : "Permitir edición"} onClick={() => toggleEdit(job)}>
                    {job.editEnabled ? <Eye size={16} /> : <Pencil size={16} />}
                  </button>
                  <button title="Eliminar acceso" onClick={() => deleteJob(job)}>
                    <UserX size={16} />
                  </button>
                  {job.submittedAt && <a href={`/api/admin/jobs/${job.id}/result`}>Resultado</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SecurityPage(): JSX.Element {
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");
  const [verify, setVerify] = useState("");
  const [lockdown, setLockdown] = useState(false);

  const reload = async () => {
    try {
      const [rows, mode] = await Promise.all([api.audit("security"), api.lockdown()]);
      setAudit(rows);
      setLockdown(mode.enabled);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Seguridad.");
    }
  };

  useEffect(() => {
    void reload();
    const interval = window.setInterval(() => void reload(), 2_500);
    return () => window.clearInterval(interval);
  }, []);

  const visibleRows = audit.filter((row) => highlightedEvents.has(row.eventType));

  return (
    <section>
      <header className="page-header">
        <h1>Seguridad en tiempo real</h1>
        <div className="header-actions">
          <button className="ghost" type="button" onClick={reload}><RotateCw size={16} />Actualizar</button>
          <button className={lockdown ? "danger-button" : "primary-button"} onClick={() => api.setLockdown(!lockdown).then((value) => setLockdown(value.enabled))}>
            <ShieldAlert size={16} />{lockdown ? "Quitar emergencia" : "Emergencia"}
          </button>
        </div>
      </header>
      {verify && <p className="status-line">{verify}</p>}
      {error && <p className="form-error">{error}</p>}
      <div className="security-summary">
        <span>Modo emergencia: <strong>{lockdown ? "Activo" : "Inactivo"}</strong></span>
        <button className="ghost small" onClick={() => api.verifyAudit().then((result) => setVerify(`${result.message} (${result.checked})`))}>Verificar integridad</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Evento</th><th>Usuario</th><th>Dispositivo</th><th>IP</th><th>Recurso</th><th>Detalle</th></tr></thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className={highlightedEvents.has(row.eventType) ? "warn-row" : ""}>
                <td>{formatDate(row.timestamp)}</td>
                <td>{eventLabels[row.eventType] ?? row.eventType}</td>
                <td className="mono">{row.userId ?? "-"}</td>
                <td className="mono">{row.deviceId ?? "-"}</td>
                <td>{row.ip ?? "-"}</td>
                <td>{row.resourceType ?? "-"} {row.resourceId ?? ""}</td>
                <td>{formatMetadata(row.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("es-CO");
}

function formatMetadata(value: Record<string, unknown>): string {
  const keys = Object.keys(value ?? {});
  if (keys.length === 0) {
    return "-";
  }
  return keys.map((key) => {
    const label = metadataKeyLabels[key] ?? key;
    const raw = String(value[key]);
    const translated = metadataValueLabels[raw] ?? raw;
    return `${label}: ${translated}`;
  }).join(", ");
}
