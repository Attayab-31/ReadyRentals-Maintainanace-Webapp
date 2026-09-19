import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { setStoredToken, getStoredToken } from "../api/client";
import { login } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner/ErrorBanner";
import { useTheme } from "../hooks/useTheme";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  if (getStoredToken()) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await login(email, password);
      setStoredToken(res.access_token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.screen}>
      <form className={`${styles.form} stack`} onSubmit={onSubmit}>
        <div className={styles.identity}>
          <div className={styles.mark}>MO</div>
          <div>
            <p className={styles.eyebrow}>Property operations</p>
            <p className={styles.identityName}>Maintenance Work Orders</p>
          </div>
        </div>
        <div className={styles.headingRow}>
          <div>
            <p className={styles.eyebrow}>Manager access</p>
            <h1>Sign in</h1>
          </div>
          <button type="button" className="btn theme-toggle" onClick={toggle}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
        <p className={styles.lede}>Manage work orders, technician links, categories, and completed reports from one place.</p>
        <ErrorBanner error={error} />
        <div className={styles.fields}>
          <label className="field">
            <span>Email address</span>
            <input className="input" type="email" autoComplete="username" placeholder="manager@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
        <p className={styles.footerNote}>Field technicians and tenants use their secure technician link. They do not need an account.</p>
      </form>
    </main>
  );
}
