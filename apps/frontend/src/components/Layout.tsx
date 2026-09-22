import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { FileSpreadsheet, HardDrive, LogOut, Shield, Users } from "lucide-react";
import { api, UserSession } from "../api/client";

interface LayoutProps {
  session: UserSession;
  onLogout: () => void;
}

const adminLinks = [
  { to: "/admin/users", label: "Usuarios", icon: Users },
  { to: "/admin/devices", label: "Dispositivos", icon: HardDrive },
  { to: "/admin/files", label: "Archivos", icon: FileSpreadsheet },
  { to: "/admin/security", label: "Seguridad", icon: Shield }
];

export function Layout({ session, onLogout }: LayoutProps): JSX.Element {
  const navigate = useNavigate();
  const notified = useRef(new Set<string>());
  const links = session.role === "ADMIN" ? adminLinks : [{ to: "/employee", label: "Mis archivos", icon: FileSpreadsheet }];

  useEffect(() => {
    if (session.role !== "ADMIN") {
      return;
    }
    const poll = () => {
      void api.unreadNotifications()
        .then((rows) => {
          const fresh = rows.filter((row) => !notified.current.has(row.id));
          fresh.forEach((row) => notified.current.add(row.id));
          const newest = fresh[0];
          if (newest) {
            window.dispatchEvent(new CustomEvent("restricted-action", { detail: newest.message }));
            void api.markNotificationsRead().catch(() => undefined);
          }
        })
        .catch(() => undefined);
    };
    poll();
    const interval = window.setInterval(poll, 5_000);
    return () => window.clearInterval(interval);
  }, [session.role]);

  useEffect(() => {
    const invalidate = () => {
      onLogout();
      navigate("/login", { replace: true });
    };
    window.addEventListener("session-invalid", invalidate);
    const interval = window.setInterval(() => {
      void api.me().catch(() => undefined);
    }, 3_000);
    return () => {
      window.removeEventListener("session-invalid", invalidate);
      window.clearInterval(interval);
    };
  }, [navigate, onLogout]);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    onLogout();
    navigate("/login");
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to={session.role === "ADMIN" ? "/admin/users" : "/employee"} className="brand">
          <span className="brand-mark">ES</span>
          <span>Excel Seguro</span>
        </Link>
        <nav>
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <button className="icon-text ghost" type="button" onClick={logout}>
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
