import { ApiError } from "../../api/client";
import { friendlyErrorMessage } from "../../api/client";
import styles from "./ErrorBanner.module.css";

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const detail = friendlyErrorMessage(error);
  const status = error instanceof ApiError ? error.status : undefined;
  const title = status === 401
    ? "Sign-in required"
    : status === 404
      ? "Not found"
      : status === 503
        ? "Temporary service problem"
        : status && status >= 500
          ? "Server problem"
          : status === 422
            ? "Please check the highlighted information"
            : "Please check this action";
  return (
    <div className={styles.banner} role="alert">
      <div className={styles.title}>{title}</div>
      <div className={styles.detail}>{detail}</div>
      {status ? <div className={styles.code}>Reference: {status}</div> : null}
    </div>
  );
}
