import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { deleteWorkOrder, downloadManagerPdf, listWorkOrders } from "../api/endpoints";
import type { WorkOrderListFilters, WorkOrderStatus } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { ErrorBanner } from "../components/ErrorBanner/ErrorBanner";
import { PriorityBadge } from "../components/PriorityBadge/PriorityBadge";
import { StatusBadge } from "../components/StatusBadge/StatusBadge";
import { useToast } from "../hooks/useToast";
import { queryKeys } from "../lib/queryKeys";
import styles from "./DashboardPage.module.css";

const STATUSES: Array<WorkOrderStatus | "overdue"> = [
  "assigned",
  "in_progress",
  "completed_pending_signoff",
  "signed_off",
  "overdue",
];

const STATUS_LABELS: Record<WorkOrderStatus | "overdue", string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  completed_pending_signoff: "Pending signatures",
  signed_off: "Completed",
  overdue: "Overdue only",
};

function filtersFromSearch(sp: URLSearchParams): WorkOrderListFilters {
  const status = sp.get("status") as WorkOrderStatus | "overdue" | null;
  const overdue = status === "overdue" ? true : sp.get("overdue") === "true";

  return {
    status: status && status !== "overdue" && STATUSES.includes(status) ? status : undefined,
    address: sp.get("address") || undefined,
    overdue: overdue ? true : undefined,
    date_from: sp.get("date_from") || undefined,
    date_to: sp.get("date_to") || undefined,
  };
}

export function DashboardPage() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [actionError, setActionError] = useState<unknown>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [workOrderToDelete, setWorkOrderToDelete] = useState<{ id: number; number: string } | null>(null);
  const filters = filtersFromSearch(sp);
  const query = useQuery({
    queryKey: queryKeys.workOrders(filters),
    queryFn: () => listWorkOrders(filters),
  });

  async function downloadPdf(id: number) {
    setActionError(null);
    setPendingAction(`pdf:${id}`);
    try {
      await downloadManagerPdf(id);
    } catch (error) {
      setActionError(error);
    } finally {
      setPendingAction(null);
    }
  }

  async function removeWorkOrder(id: number) {
    setActionError(null);
    setPendingAction(`delete:${id}`);
    try {
      await deleteWorkOrder(id);
      await qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast("Work order deleted");
      setWorkOrderToDelete(null);
    } catch (error) {
      setActionError(error);
    } finally {
      setPendingAction(null);
    }
  }

  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = new URLSearchParams();
    const status = String(fd.get("status") || "");
    const address = String(fd.get("address") || "").trim();
    const date_from = String(fd.get("date_from") || "");
    const date_to = String(fd.get("date_to") || "");

    if (status) next.set("status", status);
    if (address) next.set("address", address);
    if (status === "overdue") next.set("overdue", "true");
    if (date_from) next.set("date_from", date_from);
    if (date_to) next.set("date_to", date_to);
    setSp(next, { replace: true });
  }

  return (
    <main className="page page-wide">
      <div className={styles.head}>
        <div>
          <h1>Dashboard</h1>
          <p className={styles.muted}>Find work orders by status, address, dates, or overdue items.</p>
        </div>
        <Link className="btn btn-primary" to="/work-orders/new">
          New work order
        </Link>
      </div>
      <form className={`card ${styles.filters}`} onSubmit={apply}>
        <label className="field">
          <span>Status</span>
          <select className="select" name="status" defaultValue={filters.status || ""}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Address</span>
          <input className="input" name="address" defaultValue={filters.address || ""} />
        </label>
        <label className="field">
          <span>Date from</span>
          <input className="input" type="date" name="date_from" defaultValue={filters.date_from || ""} />
        </label>
        <label className="field">
          <span>Date to</span>
          <input className="input" type="date" name="date_to" defaultValue={filters.date_to || ""} />
        </label>
        <button className="btn" type="submit">
          Apply filters
        </button>
      </form>
      <div className="stack" style={{ marginTop: 16 }}>
        <ErrorBanner error={query.error} />
        <ErrorBanner error={actionError} />
        <div className={styles.mobileList}>
          {(query.data || []).map((wo) => (
            <article className={`card ${styles.mobileCard}`} key={wo.id}>
              <div className={styles.mobileCardHead}>
                <Link to={`/work-orders/${wo.id}`}>{wo.work_order_number}</Link>
                <StatusBadge status={wo.status} />
              </div>
              <p className={styles.mobileAddress}>{wo.service_address}</p>
              <p className={styles.mobileMeta}>{wo.tenant_names} · {wo.priority.name}</p>
              <div className={styles.mobileCardFoot}>
                <span className={wo.within_target === false ? styles.no : styles.yes}>
                  {wo.within_target == null ? "Target pending" : wo.within_target ? "Within target" : "Over target"}
                </span>
                <div className={styles.actions}>
                  {wo.pdf_url ? (
                    <button type="button" className="btn" disabled={pendingAction !== null} onClick={() => void downloadPdf(wo.id)}>
                      {pendingAction === `pdf:${wo.id}` ? "Downloading..." : "PDF"}
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-danger" disabled={pendingAction !== null} onClick={() => setWorkOrderToDelete({ id: wo.id, number: wo.work_order_number })}>
                    {pendingAction === `delete:${wo.id}` ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </article>
          ))}
          {query.data?.length === 0 ? <p className={styles.muted}>No work orders match these filters.</p> : null}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Work order</th>
                <th>Address</th>
                <th>Tenant</th>
                <th>Status</th>
                <th>Priority</th>
                <th>SLA target</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(query.data || []).map((wo) => (
                <tr key={wo.id}>
                  <td>
                    <Link to={`/work-orders/${wo.id}`}>{wo.work_order_number}</Link>
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
                          onClick={() => void downloadPdf(wo.id)}
                        >
                          {pendingAction === `pdf:${wo.id}` ? "Downloading…" : "Download PDF"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={pendingAction !== null}
                        onClick={() => setWorkOrderToDelete({ id: wo.id, number: wo.work_order_number })}
                      >
                        {pendingAction === `delete:${wo.id}` ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {query.data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.muted}>
                    No work orders match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ConfirmDialog
          open={workOrderToDelete !== null}
          title="Delete work order?"
          message={workOrderToDelete ? `${workOrderToDelete.number} and its photos, signatures, and PDF will be permanently removed.` : ""}
          confirmLabel="Delete work order"
          danger
          busy={pendingAction?.startsWith("delete:")}
          onCancel={() => setWorkOrderToDelete(null)}
          onConfirm={() => {
            if (workOrderToDelete) void removeWorkOrder(workOrderToDelete.id);
          }}
        />
      </div>
    </main>
  );
}
