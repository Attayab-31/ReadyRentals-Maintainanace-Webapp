import { useEffect } from "react";
import styles from "./Toast.module.css";

export function Toast({
  message,
  tone,
  onDone,
}: {
  message: string;
  tone: "ok" | "err";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(t);
  }, [message, onDone]);

  return (
    <div className={`${styles.toast} ${tone === "ok" ? styles.ok : styles.err}`} role="status">
      {message}
    </div>
  );
}
