import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { downloadManagerPdf } from "../../api/endpoints";
import type { WorkOrderListFilters, WorkOrderStatus } from "../../api/types";
import { ConfirmDialog, ErrorBanner } from "../../components";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useAdminsQuery } from "../admins/hooks/useAdmins";
import { useDeleteWorkOrderMutation, useWorkOrdersListQuery } from "../work-orders/hooks/useWorkOrders";
import { DashboardFilters } from "./components/DashboardFilters";
import { DashboardMobileList } from "./components/DashboardMobileList";
import { DashboardTable } from "./components/DashboardTable";
import styles from "./DashboardView.module.css";

const STATUSES: Array<WorkOrderStatus | "overdue"> = [
  "assigned",
  "in_progress",
  "completed_pending_signoff",
  "signed_off",
  "overdue",
];

function filtersFromSearch(sp: URLSearchParams): WorkOrderListFilters {
  const status = sp.get("status") as WorkOrderStatus | "overdue" | null;
  const overdue = status === "overdue" ? true : sp.get("overdue") === "true";
  const assigned_by_id = sp.get("assigned_by_id") ? Number(sp.get("assigned_by_id")) : undefined;

  return {
    status: status && status !== "overdue" && STATUSES.includes(status) ? status : undefined,
    address: sp.get("address") || undefined,
    overdue: overdue ? true : undefined,
    date_from: sp.get("date_from") || undefined,
    date_to: sp.get("date_to") || undefined,
    assigned_by_id: Number.isFinite(assigned_by_id) ? assigned_by_id : undefined,
  };
}

export function DashboardView() {
  const [sp, setSp] = useSearchParams();
  const currentUser = useCurrentUser();
  const isOwner = currentUser.data?.role === "owner";

  const [actionError, setActionError] = useState<unknown>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [workOrderToDelete, setWorkOrderToDelete] = useState<{ id: number; number: string } | null>(null);

  const filters = filtersFromSearch(sp);
  const query = useWorkOrdersListQuery(filters);
  const adminsQuery = useAdminsQuery(isOwner);

  const deleteMutation = useDeleteWorkOrderMutation({
    onSuccess: () => {
      setWorkOrderToDelete(null);
    },
    onError: (err) => {
      setActionError(err);
      setWorkOrderToDelete(null);
    },
  });

  async function handleDownloadPdf(id: number) {
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

  function handleRemoveWorkOrder(id: number) {
    setActionError(null);
    deleteMutation.mutate(id);
  }

  function handleFilterSubmit(fd: FormData) {
    const next = new URLSearchParams();
    const status = String(fd.get("status") || "");
    const address = String(fd.get("address") || "").trim();
    const date_from = String(fd.get("date_from") || "");
    const date_to = String(fd.get("date_to") || "");
    const assigned_by_id = String(fd.get("assigned_by_id") || "");

    if (status) next.set("status", status);
    if (address) next.set("address", address);
    if (status === "overdue") next.set("overdue", "true");
    if (date_from) next.set("date_from", date_from);
    if (date_to) next.set("date_to", date_to);
    if (assigned_by_id) next.set("assigned_by_id", assigned_by_id);
    setSp(next, { replace: true });
  }

  function handleToggleMyOnly() {
    const next = new URLSearchParams(sp);
    const isCurrentlyActive = Boolean(
      currentUser.data?.id && filters.assigned_by_id === currentUser.data.id
    );

    if (!isCurrentlyActive && currentUser.data?.id) {
      next.set("assigned_by_id", String(currentUser.data.id));
    } else {
      next.delete("assigned_by_id");
    }
    setSp(next, { replace: true });
  }

  function handleResetFilters() {
    setSp(new URLSearchParams(), { replace: true });
  }

  const isMyOnlyActive = Boolean(
    currentUser.data?.id && filters.assigned_by_id === currentUser.data.id
  );

  const workOrders = query.data || [];

  return (
    <main className="page page-wide">
      <div className={styles.head}>
        <div>
          <h1>Dashboard</h1>
          <p className={styles.muted}>
            Oversee maintenance work orders, technician progress, and PDF service reports.
          </p>
        </div>
        <Link className="btn btn-primary" to="/work-orders/new">
          New work order
        </Link>
      </div>

      <DashboardFilters
        filters={filters}
        isOwner={isOwner}
        admins={adminsQuery.data}
        currentUser={currentUser.data}
        onFilterSubmit={handleFilterSubmit}
        onToggleMyOnly={handleToggleMyOnly}
        onReset={handleResetFilters}
        isMyOnlyActive={isMyOnlyActive}
      />

      <div className="stack" style={{ marginTop: 16 }}>
        <ErrorBanner error={query.error} />
        <ErrorBanner error={actionError} />

        <DashboardMobileList
          workOrders={workOrders}
          pendingAction={pendingAction}
          onDownloadPdf={handleDownloadPdf}
          onRequestDelete={setWorkOrderToDelete}
        />

        <DashboardTable
          workOrders={workOrders}
          pendingAction={pendingAction}
          onDownloadPdf={handleDownloadPdf}
          onRequestDelete={setWorkOrderToDelete}
        />

        <ConfirmDialog
          open={workOrderToDelete !== null}
          title={`Delete work order ${workOrderToDelete?.number}?`}
          message="This removes the work order and its photos. This cannot be undone."
          confirmLabel="Delete work order"
          danger
          busy={deleteMutation.isPending}
          onCancel={() => setWorkOrderToDelete(null)}
          onConfirm={() => {
            if (workOrderToDelete) {
              handleRemoveWorkOrder(workOrderToDelete.id);
            }
          }}
        />
      </div>
    </main>
  );
}
