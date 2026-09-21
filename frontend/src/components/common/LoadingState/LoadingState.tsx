import styles from "./LoadingState.module.css";

interface LoadingStateProps {
  message?: string;
  minHeight?: string;
}

export function LoadingState({ message = "Loading…", minHeight }: LoadingStateProps) {
  return (
    <div className={styles.wrapper} style={{ minHeight }} role="status" aria-busy="true">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.text}>{message}</p>
    </div>
  );
}
