import type { WorkOrderItem } from "../../../api/types";
import { PhotoSlot } from "../../PhotoSlot/PhotoSlot";
import styles from "./WorkOrderItemSummary.module.css";

interface WorkOrderItemSummaryProps {
  item: WorkOrderItem;
}

export function WorkOrderItemSummary({ item }: WorkOrderItemSummaryProps) {
  return (
    <article className={`card stack ${styles.card}`}>
      <div className={styles.header}>
        <h2 className={styles.category}>{item.category}</h2>
        <span
          className={`${styles.statusBadge} ${
            item.resolved ? styles.resolved : styles.unresolved
          }`}
        >
          {item.resolved ? "Resolved" : "Not resolved"}
        </span>
      </div>

      <div className={styles.detailRow}>
        <strong>Details:</strong> <span>{item.details || "—"}</span>
      </div>

      {item.tech_notes ? (
        <div className={styles.notesRow}>
          <strong>Technician Notes:</strong> <span>{item.tech_notes}</span>
        </div>
      ) : null}

      <div className={styles.photos}>
        <PhotoSlot
          label="Before"
          src={item.before_photo_url}
          skipped={item.before_photo_skipped}
          readOnly
        />
        <PhotoSlot
          label="After"
          src={item.after_photo_url}
          skipped={item.after_photo_skipped}
          readOnly
        />
      </div>
    </article>
  );
}
