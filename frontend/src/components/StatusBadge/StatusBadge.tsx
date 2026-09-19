import type { WorkOrderStatus } from "../../api/types";
import styles from "./StatusBadge.module.css";

const LABELS: Record<WorkOrderStatus, string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  completed_pending_signoff: "Pending signatures",
  signed_off: "Completed",
};

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  return <span className={`${styles.badge} ${styles[status]}`}>{LABELS[status]}</span>;
}
