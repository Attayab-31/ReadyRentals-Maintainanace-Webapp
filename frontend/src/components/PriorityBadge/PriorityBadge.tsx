import type { Priority, PriorityInfo } from "../../api/types";
import { hourTarget, priorityCode } from "../../lib/format";
import styles from "./PriorityBadge.module.css";

export function PriorityBadge({
  priority,
}: {
  priority: PriorityInfo | Priority | null | undefined;
}) {
  const code = priorityCode(priority);
  return (
    <span className={styles.badge}>
      {code ? code.charAt(0).toUpperCase() + code.slice(1) : "Priority"}
      <span className={styles.hours}>{hourTarget(priority)}h</span>
    </span>
  );
}
