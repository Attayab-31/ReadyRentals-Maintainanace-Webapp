import { Link } from "react-router-dom";
import type { AuditLogItem } from "../../../api/types";
import { Modal } from "../../../components";
import { formatRelativeTime, formatStamp } from "../../../lib/format";
import { AuditActionBadge } from "./AuditActionBadge";
import styles from "./AuditDetailModal.module.css";

interface AuditDetailModalProps {
  log: AuditLogItem | null;
  onClose: () => void;
}

export function AuditDetailModal({ log, onClose }: AuditDetailModalProps) {
  if (!log) return null;

  return (
    <Modal
      open={Boolean(log)}
      onClose={onClose}
      title={`Audit Event #${log.id}`}
      subtitle={`${formatStamp(log.created_at)} (${formatRelativeTime(log.created_at)})`}
      maxWidth="680px"
      footer={
        <div className={styles.modalActions}>
          {log.entity_type === "work_order" && log.entity_id ? (
            <Link
              className="btn btn-primary"
              to={`/work-orders/${log.entity_id}`}
              onClick={onClose}
            >
              Open Work Order
            </Link>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className={styles.detailGrid}>
        <div className={styles.detailItem}>
          <span className={styles.detailItemLabel}>Admin / Actor</span>
          <span className={styles.detailItemValue}>
            {log.actor_name} ({log.actor_role})
          </span>
          <span className={styles.detailItemSub}>{log.actor_email}</span>
        </div>

        <div className={styles.detailItem}>
          <span className={styles.detailItemLabel}>Action Code</span>
          <div style={{ marginTop: 4 }}>
            <AuditActionBadge action={log.action} />
          </div>
          <span className={`mono ${styles.detailItemSub}`} style={{ marginTop: 2 }}>
            {log.action}
          </span>
        </div>

        <div className={styles.detailItem}>
          <span className={styles.detailItemLabel}>Target Resource</span>
          <span className={styles.detailItemValue}>
            {log.entity_name || log.entity_id || log.entity_type}
          </span>
          <span className={styles.detailItemSub}>Type: {log.entity_type}</span>
        </div>

        <div className={styles.detailItem}>
          <span className={styles.detailItemLabel}>Client IP Address</span>
          <span className={`mono ${styles.detailItemValue}`} style={{ marginTop: 4 }}>
            {log.ip_address || "Internal / Not captured"}
          </span>
        </div>
      </div>

      <div>
        <span className={styles.detailItemLabel}>Event Summary</span>
        <p className={styles.eventSummary}>{log.description}</p>
      </div>

      {log.parsed_details ? (
        <div>
          <span className={styles.detailItemLabel}>Metadata / Payload Details</span>
          <pre className={styles.detailJsonBox}>
            {JSON.stringify(log.parsed_details, null, 2)}
          </pre>
        </div>
      ) : null}
    </Modal>
  );
}
