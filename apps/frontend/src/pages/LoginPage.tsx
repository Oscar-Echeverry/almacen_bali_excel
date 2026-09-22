import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api, BrowserDeviceIdentity, UserSession } from "../api/client";

interface LoginPageProps {
  onLogin: (session: UserSession) => void;
}

const deviceTokenKey = "secure-spreadsheet.browser-device-token";
const deviceNameKey = "secure-spreadsheet.browser-device-name";

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return [...array].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function browserName(): string {
  const platform = navigator.platform || "Equipo";
  const browser = navigator.userAgent.split(" ").at(-1) || "Navegador";
  return `${platform} - ${browser}`.slice(0, 160);
}

function browserDeviceIdentity(): BrowserDeviceIdentity {
  let token = localStorage.getItem(deviceTokenKey);
  if (!token) {
    token = randomHex(32);
    localStorage.setItem(deviceTokenKey, token);
  }
  let name = localStorage.getItem(deviceNameKey);
  if (!name) {
    name = browserName();
    localStorage.setItem(deviceNameKey, name);
  }
  return { browserDeviceToken: token, browserDeviceName: name };
}

export function LoginPage({ onLogin }: LoginPageProps): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      onLogin(await api.login(email, password, undefined, browserDeviceIdentity()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-heading">
          <ShieldCheck size={32} />
          <div>
            <h1 id="login-title">Excel Seguro</h1>
            <p>Acceso privado</p>
          </div>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={loading} type="submit">{loading ? "Validando..." : "Entrar"}</button>
        </form>
      </section>
    </main>
  );
}
