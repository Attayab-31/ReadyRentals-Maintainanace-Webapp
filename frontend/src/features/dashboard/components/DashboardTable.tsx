import { Link } from "react-router-dom";
import type { WorkOrder } from "../../../api/types";
import { PriorityBadge, StatusBadge } from "../../../components";
import styles from "./DashboardTable.module.css";

interface DashboardTableProps {
  workOrders: WorkOrder[];
  pendingAction: string | null;
  onDownloadPdf: (id: number) => void;
  onRequestDelete: (workOrder: { id: number; number: string }) => void;
}

export function DashboardTable({
  workOrders,
  pendingAction,
  onDownloadPdf,
  onRequestDelete,
}: DashboardTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Work order</th>
            <th>Assigned by</th>
            <th>Address</th>
            <th>Tenant</th>
            <th>Status</th>
            <th>Priority</th>
            <th>SLA target</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {workOrders.map((wo) => (
            <tr key={wo.id}>
              <td>
                <Link to={`/work-orders/${wo.id}`} className={styles.link}>
                  {wo.work_order_number}
                </Link>
              </td>
              <td>
                <strong>{wo.created_by_name || "Office"}</strong>
              </td>
              <td>{wo.service_address}</td>
              <td>{wo.tenant_names}</td>
              <td>
                <StatusBadge status={wo.status} />
              </td>
              <td>
                <PriorityBadge priority={wo.priority} />
              </td>
              <td>
                {wo.within_target == null ? (
                  <span className={styles.muted}>—</span>
                ) : wo.within_target ? (
                  <span className={styles.yes}>Within target</span>
                ) : (
                  <span className={styles.no}>Over target</span>
                )}
              </td>
              <td>
                <div className={styles.actions}>
                  {wo.pdf_url ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={pendingAction !== null}
                      onClick={() => onDownloadPdf(wo.id)}
                    >
                      {pendingAction === `pdf:${wo.id}` ? "Downloading…" : "Download PDF"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={pendingAction !== null}
                    onClick={() => onRequestDelete({ id: wo.id, number: wo.work_order_number })}
                  >
                    {pendingAction === `delete:${wo.id}` ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {workOrders.length === 0 ? (
            <tr>
              <td colSpan={8} className={styles.empty}>
                No work orders match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
