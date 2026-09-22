import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ColDef, ModuleRegistry } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { api, JobRow, UserSession } from "../api/client";
import { useIsMobile } from "../hooks/useIsMobile";
import { useSecurityRestrictions } from "../hooks/useSecurityRestrictions";
import { Watermark } from "../components/Watermark";

ModuleRegistry.registerModules([AllCommunityModule]);

interface WorkspaceProps {
  session: UserSession;
}

interface GridRecord {
  rowNumber: number;
  addresses: Record<string, string>;
  editable: Record<string, boolean>;
  modified: Record<string, boolean>;
  [key: string]: string | number | boolean | Record<string, string> | Record<string, boolean> | null;
}

const WORKSHEET_ROW_LIMIT = 500;

const jobStatusLabels: Record<string, string> = {
  ASSIGNED: "Asignado",
  IN_PROGRESS: "En edición",
  SUBMITTED: "Enviado",
  LOCKED: "Bloqueado",
  ARCHIVED: "Archivado"
};

export function EmployeeDashboard(): JSX.Element {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => void api.jobs().then((loaded) => {
      setJobs(loaded);
      setError("");
    }).catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los archivos."));
    load();
    const interval = window.setInterval(load, 5_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section>
      <header className="page-header"><h1>Mis archivos</h1></header>
      {error && <p className="form-error">{error}</p>}
      <div className="job-list">
        {jobs.map((job) => (
          <button className="job-tile" key={job.id} onClick={() => navigate(`/employee/jobs/${job.id}`)}>
            <strong>{job.workbookName}</strong>
            <span>{job.editEnabled ? "Puede editar" : "Solo lectura"}</span>
            <small>{jobStatusLabels[job.status] ?? job.status}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function columnName(index: number): string {
  let name = "";
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function excelWidthToPixels(width: number | null | undefined): number {
  if (!width) {
    return 128;
  }
  return Math.min(420, Math.max(76, Math.round(width * 7 + 24)));
}

function formatGridValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "VERDADERO" : "FALSO";
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("es-CO");
    }
  }
  return String(value);
}

export function WorkspacePage({ session }: WorkspaceProps): JSX.Element {
  const { jobId = "" } = useParams();
  const mobile = useIsMobile();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [rows, setRows] = useState<GridRecord[]>([]);
  const [columns, setColumns] = useState<ColDef<GridRecord>[]>([]);
  const [rowSummary, setRowSummary] = useState<{ loaded: number; total: number } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [readonly, setReadonly] = useState(true);
  const workspaceToken = useMemo(() => crypto.randomUUID(), [jobId]);
  const navigate = useNavigate();
  const kickedOut = useRef(false);

  const leaveFile = useCallback((message: string) => {
    if (kickedOut.current) {
      return;
    }
    kickedOut.current = true;
    window.dispatchEvent(new CustomEvent("restricted-action", { detail: message }));
    void api.releaseJob(jobId, workspaceToken).catch(() => undefined);
    navigate("/employee", { replace: true });
  }, [jobId, navigate, workspaceToken]);

  const security = useSecurityRestrictions("job", jobId, {
    onCaptureBlocked: () => leaveFile("Captura prohibida. Se cerró el archivo y se notificó a Seguridad.")
  });

  const currentJob = useMemo(() => jobs.find((job) => job.id === jobId), [jobId, jobs]);
  const currentWorksheet = useMemo(() => currentJob?.worksheets.find((sheet) => sheet.id === selectedSheet), [currentJob, selectedSheet]);

  useEffect(() => {
    const load = () => void api.jobs().then((loaded) => {
      setJobs(loaded);
      const job = loaded.find((candidate) => candidate.id === jobId);
      if (!job) {
        leaveFile("El administrador retiró el acceso a este archivo.");
        return;
      }
      setReadonly(!job.viewAccessEnabled || !job.editEnabled || job.status === "SUBMITTED" || job.status === "LOCKED");
    }).catch(() => leaveFile("La sesión del archivo fue cerrada por seguridad."));
    load();
    const interval = window.setInterval(load, 5_000);
    return () => window.clearInterval(interval);
  }, [jobId, leaveFile]);

  useEffect(() => {
    if (!selectedSheet && currentJob?.worksheets[0]) {
      setSelectedSheet(currentJob.worksheets[0].id);
    }
  }, [currentJob, selectedSheet]);

  useEffect(() => {
    if (!selectedSheet || !jobId) {
      return;
    }
    void api.rows(jobId, selectedSheet, 0, WORKSHEET_ROW_LIMIT, workspaceToken).then((page) => {
      const mapped = page.rows.map((row) => {
        const record: GridRecord = { rowNumber: row.rowNumber, addresses: {}, editable: {}, modified: {} };
        row.cells.forEach((cell, index) => {
          const field = `c${index + 1}`;
          record[field] = cell.value;
          record.addresses[field] = cell.address;
          record.editable[field] = cell.editable;
          record.modified[field] = cell.modified;
        });
        return record;
      });
      const first = page.rows[0];
      const visibleColumnCount = Math.max(first?.cells.length ?? 0, currentWorksheet?.columnCount ?? 0, currentWorksheet?.columnWidths?.length ?? 0);
      setColumns([
        { field: "rowNumber", headerName: "#", width: 78, pinned: "left", editable: false },
        ...Array.from({ length: visibleColumnCount }, (_, index) => {
          const field = `c${index + 1}`;
          return {
            field,
            headerName: columnName(index + 1),
            width: excelWidthToPixels(currentWorksheet?.columnWidths?.[index]),
            minWidth: 76,
            maxWidth: 420,
            editable: (params) => !readonly && Boolean(params.data?.editable[field]),
            suppressMovable: true,
            resizable: true,
            valueFormatter: (params) => formatGridValue(params.value),
            cellClass: (params) => [
              params.data?.modified[field] ? "cell-modified" : "",
              params.data?.editable[field] ? "" : "cell-readonly"
            ].filter(Boolean).join(" ")
          } satisfies ColDef<GridRecord>;
        })
      ]);
      setRowSummary({ loaded: page.rows.length, total: page.totalRows });
      setRows(mapped);
    }).catch(() => leaveFile("No se pudo mantener este archivo abierto. Revise si está abierto en otra pestaña."));
  }, [currentWorksheet, jobId, leaveFile, readonly, selectedSheet, workspaceToken]);

  useEffect(() => {
    if (!jobId) {
      return;
    }
    const beat = () => void api.heartbeatJob(jobId, workspaceToken)
      .catch(() => leaveFile("Este archivo se cerró porque se abrió en otra pestaña o navegador."));
    beat();
    const interval = window.setInterval(beat, 5_000);
    const release = () => {
      void api.releaseJob(jobId, workspaceToken).catch(() => undefined);
    };
    window.addEventListener("pagehide", release);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [jobId, leaveFile, workspaceToken]);

  if (mobile) {
    return <section className="blocked-module"><h1>Módulo no disponible</h1><p>Este módulo solo puede utilizarse desde un computador autorizado.</p></section>;
  }

  const submit = async () => {
    if (window.confirm("Después de enviar este trabajo no podrá realizar nuevas modificaciones.")) {
      await api.submitJob(jobId, workspaceToken);
      setReadonly(true);
      leaveFile("Trabajo enviado. El administrador recibió una notificación.");
    }
  };

  return (
    <section className="workspace">
      <header className="workspace-header">
        <div>
          <h1>{currentJob?.workbookName ?? "Archivo"}</h1>
          <div className="workspace-status">
            <span className={`save-state ${saveState}`}>
              {readonly ? "Solo lectura" : saveState === "saving" ? "Guardando..." : saveState === "saved" ? "Guardado" : saveState === "error" ? "Error" : "Edición habilitada"}
            </span>
            {rowSummary && rowSummary.total > 0 && (
              <span>{rowSummary.loaded < rowSummary.total ? `Mostrando ${rowSummary.loaded} de ${rowSummary.total} filas` : `${rowSummary.total} filas`}</span>
            )}
          </div>
        </div>
        <button className="primary-button" disabled={readonly} onClick={submit}>Enviar trabajo</button>
      </header>
      <div className="sheet-tabs">
        {currentJob?.worksheets.map((sheet) => (
          <button key={sheet.id} className={sheet.id === selectedSheet ? "active" : ""} onClick={() => setSelectedSheet(sheet.id)}>
            {sheet.name}
          </button>
        ))}
      </div>
      <div className="sensitive-zone">
        <Watermark userName={session.id} deviceName={session.deviceId ?? "DEV"} sessionPublicId={session.sessionPublicId} />
        {security.blanked && (
          <div className="security-blanket" role="alert">
            <div>
              <strong>Pantalla protegida</strong>
              <span>El intento fue enviado al módulo de Seguridad.</span>
              <button className="primary-button" type="button" onClick={security.resetBlankScreen}>Volver al archivo</button>
            </div>
          </div>
        )}
        <div className="ag-theme-quartz grid-shell">
          <AgGridReact<GridRecord>
            rowData={rows}
            columnDefs={columns}
            defaultColDef={{
              sortable: false,
              filter: false,
              resizable: true,
              wrapText: false
            }}
            rowHeight={30}
            headerHeight={32}
            suppressClipboardPaste
            suppressCopyRowsToClipboard
            suppressCellFocus={false}
            singleClickEdit={!readonly}
            stopEditingWhenCellsLoseFocus
            onCellValueChanged={(event) => {
              const field = event.colDef.field;
              if (readonly || !field || field === "rowNumber" || !selectedSheet) {
                return;
              }
              const address = event.data?.addresses[field];
              if (!address) {
                return;
              }
              setSaveState("saving");
              void api.patchCells(jobId, [{ worksheetId: selectedSheet, cellAddress: address, newValue: event.newValue as string | number | boolean | null }], workspaceToken)
                .then(() => setSaveState("saved"))
                .catch(() => {
                  setSaveState("error");
                  leaveFile("No se pudo guardar porque el acceso cambió o el archivo está abierto en otra pestaña.");
                });
            }}
          />
        </div>
      </div>
    </section>
  );
}
