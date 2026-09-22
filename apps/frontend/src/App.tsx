import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RestrictedToast } from "./components/Toast";
import { Layout } from "./components/Layout";
import { api, UserSession } from "./api/client";
import { LoginPage } from "./pages/LoginPage";
import { DevicesPage, FilesPage, SecurityPage, UsersPage } from "./pages/AdminPages";
import { EmployeeDashboard, WorkspacePage } from "./pages/EmployeePages";

export function App(): JSX.Element {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.me()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading-screen">Cargando...</div>;
  }

  return (
    <BrowserRouter>
      <RestrictedToast />
      <Routes>
        <Route path="/login" element={session ? <Navigate to={session.role === "ADMIN" ? "/admin" : "/employee"} /> : <LoginPage onLogin={setSession} />} />
        <Route element={session ? <Layout session={session} onLogout={() => setSession(null)} /> : <Navigate to="/login" />}>
          <Route path="/admin" element={session?.role === "ADMIN" ? <Navigate to="/admin/users" /> : <Navigate to="/employee" />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/devices" element={<DevicesPage />} />
          <Route path="/admin/files" element={<FilesPage />} />
          <Route path="/admin/security" element={<SecurityPage />} />
          <Route path="/admin/jobs" element={<Navigate to="/admin/files" />} />
          <Route path="/admin/audit" element={<Navigate to="/admin/security" />} />
          <Route path="/admin/settings" element={<Navigate to="/admin/security" />} />
          <Route path="/employee" element={<EmployeeDashboard />} />
          <Route path="/employee/jobs/:jobId" element={session ? <WorkspacePage session={session} /> : <Navigate to="/login" />} />
        </Route>
        <Route path="*" element={<Navigate to={session ? session.role === "ADMIN" ? "/admin" : "/employee" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}
