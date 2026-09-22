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
          <div className={styles.mark}>RR</div>
          <div>
            <p className={styles.eyebrow}>ReadyRentalsOnline</p>
            <p className={styles.identityName}>Property Maintenance</p>
          </div>
        </div>
        <div className={styles.headingRow}>
          <div>
            <p className={styles.eyebrow}>{isOwnerSetup ? "Master Setup" : "Office & Management"}</p>
            <h1>{isOwnerSetup ? "Owner Setup" : "Sign in"}</h1>
          </div>
          <button
            type="button"
            className={`btn ${styles.themeBtn} theme-toggle`}
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
        <p className={styles.lede}>
          {isOwnerSetup
            ? "Enter your secret Owner Code to claim or set up master owner account privileges."
            : "Sign in to manage maintenance with ReadyRentalsOnline."}
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


      </form>
    </main>
  );
}
