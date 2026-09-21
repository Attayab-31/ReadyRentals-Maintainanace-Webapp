import { Link } from "react-router-dom";
import type { AuditLogItem } from "../../../api/types";
import { formatRelativeTime, formatStamp } from "../../../lib/format";
import { AuditActionBadge } from "./AuditActionBadge";
import styles from "./AuditTable.module.css";

interface AuditTableProps {
  items: AuditLogItem[];
  isLoading: boolean;
  onInspect: (item: AuditLogItem) => void;
}

export function AuditTable({ items, isLoading, onInspect }: AuditTableProps) {
  return (
    <div className={`card ${styles.tableWrap}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Resource</th>
            <th>Description</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {items.map((log) => {
            const isLogOwner = log.actor_role === "owner";
            return (
              <tr key={log.id}>
                <td className={styles.timeCol}>
                  <div className={styles.timePrimary}>{formatRelativeTime(log.created_at)}</div>
                  <div className={styles.timeSub}>{formatStamp(log.created_at)}</div>
                </td>
                <td className={styles.actorCol}>
                  <div className={styles.actorName}>{log.actor_name}</div>
                  <div className={styles.actorEmail}>{log.actor_email}</div>
                  <span className={isLogOwner ? styles.badgeRoleOwner : styles.badgeRoleAdmin}>
                    {isLogOwner ? "Owner" : "Admin"}
                  </span>
                </td>
                <td>
                  <AuditActionBadge action={log.action} />
                </td>
                <td>
                  {log.entity_type === "work_order" && log.entity_id ? (
                    <Link to={`/work-orders/${log.entity_id}`} className={`mono ${styles.targetLink}`}>
                      {log.entity_name || `WO #${log.entity_id}`}
                    </Link>
                  ) : (
                    <span className="mono">{log.entity_name || log.entity_type}</span>
                  )}
                </td>
                <td className={styles.descCol}>{log.description}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "0 10px", minHeight: "32px", fontSize: "13px" }}
                    onClick={() => onInspect(log)}
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            );
          })}
          {items.length === 0 && !isLoading ? (
            <tr>
              <td colSpan={6} className={styles.emptyCell}>
                No audit logs found matching your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
