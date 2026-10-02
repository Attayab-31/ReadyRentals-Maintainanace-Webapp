import { Link } from "react-router-dom";
import type { WorkOrder } from "../../../api/types";
import { StatusBadge } from "../../../components";
import styles from "./DashboardMobileList.module.css";

interface DashboardMobileListProps {
  workOrders: WorkOrder[];
  pendingAction: string | null;
  onDownloadPdf: (id: number) => void;
  onRequestDelete: (workOrder: { id: number; number: string }) => void;
}

export function DashboardMobileList({
  workOrders,
  pendingAction,
  onDownloadPdf,
  onRequestDelete,
}: DashboardMobileListProps) {
  return (
    <div className={styles.mobileList}>
      {workOrders.map((wo) => (
        <article className={`card ${styles.mobileCard}`} key={wo.id}>
          <div className={styles.mobileCardHead}>
            <Link to={`/work-orders/${wo.id}`} className={styles.link}>
              {wo.work_order_number}
            </Link>
            <StatusBadge status={wo.status} />
          </div>
          <p className={styles.mobileAddress}>{wo.service_address}</p>
          <p className={styles.mobileMeta}>
            Tenant: {wo.tenant_names} · Priority: {wo.priority.name}
          </p>
          <p className={styles.mobileMeta}>
            Assigned by: <strong>{wo.created_by_name || "Office"}</strong>
          </p>
          <div className={styles.mobileCardFoot}>
            <span className={wo.within_target === false ? styles.no : styles.yes}>
              {wo.within_target == null
                ? "Target pending"
                : wo.within_target
                  ? "Within target"
                  : "Over target"}
            </span>
            <div className={styles.actions}>
              {wo.pdf_url ? (
                <button
                  type="button"
                  className="btn"
                  disabled={pendingAction !== null}
                  onClick={() => onDownloadPdf(wo.id)}
                >
                  {pendingAction === `pdf:${wo.id}` ? "Downloading..." : "PDF"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn"
                disabled={pendingAction !== null}
                onClick={() => onRequestDelete({ id: wo.id, number: wo.work_order_number })}
              >
                {pendingAction === `delete:${wo.id}` ? "Moving..." : "Move to bin"}
              </button>
            </div>
          </div>
        </article>
      ))}
      {workOrders.length === 0 ? (
        <p className={styles.muted}>No work orders match these filters.</p>
      ) : null}
    </div>
  );
}
