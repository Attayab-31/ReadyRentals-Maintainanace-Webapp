import styles from "./Stepper.module.css";

const STEPS = ["Assigned", "Started", "Pending signatures", "Completed"] as const;

export function Stepper({ current }: { current: number }) {
  return (
    <ol className={styles.wrap} aria-label="Job progress">
      {STEPS.map((label, i) => (
        <li key={label} className={styles.step}>
          <span className={`${styles.bar} ${i <= current ? styles.done : ""}`} />
          <span className={`${styles.label} ${i === current ? styles.current : ""}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}
