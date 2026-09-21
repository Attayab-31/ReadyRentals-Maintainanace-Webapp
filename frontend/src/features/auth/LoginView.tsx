import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { setStoredToken, getStoredToken } from "../../api/client";
import { login, registerOwner } from "../../api/endpoints";
import { ErrorBanner } from "../../components";
import { useTheme } from "../../hooks/useTheme";
import styles from "./LoginView.module.css";

export function LoginView() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [isOwnerSetup, setIsOwnerSetup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ownerCode, setOwnerCode] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  if (getStoredToken()) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (isOwnerSetup) {
        const res = await registerOwner({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          owner_code: ownerCode.trim(),
        });
        setStoredToken(res.access_token);
        navigate("/dashboard", { replace: true });
      } else {
        const res = await login(email.trim(), password.trim());
        setStoredToken(res.access_token);
        navigate("/dashboard", { replace: true });
      }
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
            <p className={styles.eyebrow}>{isOwnerSetup ? "Master Setup" : "Office & Management"}</p>
            <h1>{isOwnerSetup ? "Owner Setup" : "Sign in"}</h1>
          </div>
          <button type="button" className="btn theme-toggle" onClick={toggle}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
        <p className={styles.lede}>
          {isOwnerSetup
            ? "Enter your secret Owner Code to claim or set up master owner account privileges."
            : "Manage work orders, technician links, categories, and completed reports from one place."}
        </p>

        <ErrorBanner error={error} />

        <div className={styles.fields}>
          {isOwnerSetup ? (
            <label className="field">
              <span>Your full name</span>
              <input
                className="input"
                type="text"
                placeholder="Owner Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          ) : null}
          <label className="field">
            <span>Email address</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              placeholder={isOwnerSetup ? "owner@example.com" : "admin@example.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              autoComplete={isOwnerSetup ? "new-password" : "current-password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {isOwnerSetup ? (
            <label className="field">
              <span>Secret Owner Code</span>
              <input
                className="input"
                type="text"
                placeholder="Enter secret owner access code"
                value={ownerCode}
                onChange={(e) => setOwnerCode(e.target.value)}
                required
              />
            </label>
          ) : null}
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending
            ? isOwnerSetup
              ? "Verifying code…"
              : "Signing in…"
            : isOwnerSetup
              ? "Activate Owner Account"
              : "Sign in"}
        </button>

        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            type="button"
            className={`btn ${styles.toggleSetupBtn}`}
            onClick={() => {
              setIsOwnerSetup(!isOwnerSetup);
              setError(null);
            }}
          >
            {isOwnerSetup
              ? "← Return to standard admin sign in"
              : "Have an Owner Code? Set up master account"}
          </button>
        </div>

        <p className={styles.footerNote}>
          Field technicians and tenants use their secure technician link. They do not need an account.
        </p>
      </form>
    </main>
  );
}
