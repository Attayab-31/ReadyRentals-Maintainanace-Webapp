import styles from "./WorkOrderSummaryGrid.module.css";

interface WorkOrderSummaryGridProps {
  timeline: string;
  timeOnSite: string;
}

export function WorkOrderSummaryGrid({ timeline, timeOnSite }: WorkOrderSummaryGridProps) {
  return (
    <div className={styles.summaryGrid}>
      <div className={styles.summaryItem}>
        <span className={styles.summaryLabel}>Work timeline</span>
        <p className={styles.summaryValue}>{timeline}</p>
      </div>
      <div className={styles.summaryItem}>
        <span className={styles.summaryLabel}>Time on site</span>
        <p className={styles.summaryValue}>{timeOnSite}</p>
      </div>
    </div>
  );
}
