import type { AuditLogItem } from "../../../api/types";
import { formatRelativeTime } from "../../../lib/format";
import { AuditActionBadge } from "./AuditActionBadge";
import styles from "./AuditMobileList.module.css";

interface AuditMobileListProps {
  items: AuditLogItem[];
  isLoading: boolean;
  onInspect: (item: AuditLogItem) => void;
}

export function AuditMobileList({ items, isLoading, onInspect }: AuditMobileListProps) {
  return (
    <div className={styles.mobileList}>
      {items.map((log) => {
        const isLogOwner = log.actor_role === "owner";
        return (
          <article key={log.id} className={styles.mobileCard}>
            <div className={styles.mobileCardTop}>
              <div className={styles.mobileCardActor}>
                <span className={styles.actorName}>{log.actor_name}</span>
                <span className={styles.actorEmail}>{log.actor_email}</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className={isLogOwner ? styles.badgeRoleOwner : styles.badgeRoleAdmin}>
                  {isLogOwner ? "Owner" : "Admin"}
                </span>
                <AuditActionBadge action={log.action} />
              </div>
            </div>
            <div className={styles.mobileCardDesc}>{log.description}</div>
            <div className={styles.mobileCardFooter}>
              <span>{formatRelativeTime(log.created_at)}</span>
              <button
                type="button"
                className="btn"
                style={{ minHeight: "32px", padding: "0 12px", fontSize: "12px" }}
                onClick={() => onInspect(log)}
              >
                View Details
              </button>
            </div>
          </article>
        );
      })}
      {items.length === 0 && !isLoading ? (
        <div className="card" style={{ textAlign: "center", padding: "24px 16px", color: "var(--ink-soft)" }}>
          No audit logs found matching your filters.
        </div>
      ) : null}
    </div>
  );
}
