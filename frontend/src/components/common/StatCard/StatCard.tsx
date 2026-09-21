import type { ReactNode } from "react";
import styles from "./StatCard.module.css";

interface StatCardProps {
  label: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, description, icon }: StatCardProps) {
  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
      </div>
      <div className={styles.value}>{value ?? "—"}</div>
      {description ? <p className={styles.description}>{description}</p> : null}
    </div>
  );
}

export function StatsGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
