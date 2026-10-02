import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { RecycleBinFilters, RecycleBinWorkOrder } from "../../api/types";
import { ConfirmDialog, ErrorBanner, Pagination, StatusBadge } from "../../components";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
  usePermanentlyDeleteWorkOrderMutation,
  useRecycleBinQuery,
  useRestoreWorkOrderMutation,
} from "../work-orders/hooks/useWorkOrders";
import styles from "./RecycleBinView.module.css";

const PAGE_SIZE = 25;
const RANGE_OPTIONS = [
  { key: "all", label: "All time" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "older", label: "90+ days" },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function formatDeletedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function filtersFromSearch(sp: URLSearchParams): RecycleBinFilters {
  return {
    deleted_from: sp.get("deleted_from") || undefined,
    deleted_to: sp.get("deleted_to") || undefined,
    search: sp.get("search") || undefined,
    limit: PAGE_SIZE,
    offset: Math.max(0, Number(sp.get("page") || "0")) * PAGE_SIZE,
  };
}

export function RecycleBinView() {
  const currentUser = useCurrentUser();
  const isOwner = currentUser.data?.role === "owner";
  const [sp, setSp] = useSearchParams();
  const [searchInput, setSearchInput] = useState(sp.get("search") || "");
  const [actionError, setActionError] = useState<unknown>(null);
  const [workOrderToDelete, setWorkOrderToDelete] = useState<RecycleBinWorkOrder | null>(null);
  useEffect(() => {
    setSearchInput(sp.get("search") || "");
  }, [sp]);

  const filters = filtersFromSearch(sp);
  const query = useRecycleBinQuery(filters, isOwner);
  const restore = useRestoreWorkOrderMutation({
    onError: setActionError,
  });
  const permanentlyDelete = usePermanentlyDeleteWorkOrderMutation({
    onSuccess: () => setWorkOrderToDelete(null),
    onError: (error) => {
      setActionError(error);
      setWorkOrderToDelete(null);
    },
  });

  function updateSearchParams(values: {
    search?: string;
    deleted_from?: string;
    deleted_to?: string;
    range?: string;
  } = {}) {
    const next = new URLSearchParams();
    if (values.search) next.set("search", values.search);
    if (values.deleted_from) next.set("deleted_from", values.deleted_from);
    if (values.deleted_to) next.set("deleted_to", values.deleted_to);
    if (values.range) next.set("range", values.range);
    setSp(next, { replace: true });
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateSearchParams({
      search: String(form.get("search") || "").trim(),
      deleted_from: String(form.get("deleted_from") || ""),
      deleted_to: String(form.get("deleted_to") || ""),
    });
  }

  function applyRange(range: RangeKey) {
    if (range === "all") {
      updateSearchParams();
    } else if (range === "older") {
      updateSearchParams({ deleted_to: shiftDate(-90), range });
    } else {
      const days = Number(range);
      updateSearchParams({
        deleted_from: shiftDate(-(days - 1)),
        deleted_to: localDateString(new Date()),
        range,
      });
    }
  }

  function resetFilters() {
    setSearchInput("");
    updateSearchParams();
  }

  function setPage(page: number) {
    const next = new URLSearchParams(sp);
    if (page <= 0) next.delete("page");
    else next.set("page", String(page));
    setSp(next, { replace: true });
  }

  if (!currentUser.isLoading && !isOwner) {
    return (
      <main className="page stack">
        <h1>Owner access required</h1>
        <p className={styles.subtitle}>
          The recycle bin is available only to the account owner.
        </p>
        <Link className="btn" to="/dashboard">Return to dashboard</Link>
      </main>
    );
  }

  const items = query.data?.items || [];
  const total = query.data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const selectedRange = sp.get("range") || "";
  const filtersActive = Boolean(filters.search || filters.deleted_from || filters.deleted_to);

  return (
    <main className={`page page-wide stack ${styles.page}`}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>OWNER WORKSPACE</span>
          <h1>Recycle bin</h1>
          <p className={styles.subtitle}>
            Review deleted work orders, restore the ones you need, or permanently remove them.
          </p>
        </div>
        <Link className={`btn ${styles.backButton}`} to="/dashboard">
          <span aria-hidden="true">←</span> Back to dashboard
        </Link>
      </div>

      <section className={styles.retentionNotice} aria-label="Recycle bin retention">
        <span className={styles.noticeIcon} aria-hidden="true">i</span>
        <div>
          <strong>Nothing is automatically removed</strong>
          <p>Work orders and their attachments stay here until you restore or permanently delete them.</p>
        </div>
      </section>

      <section className={styles.binSummary} aria-live="polite">
        <div className={styles.summaryIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5" />
          </svg>
        </div>
        <div>
          <p className={styles.summaryLabel}>Matching deleted work orders</p>
          <p className={styles.summaryValue}>
            {query.isLoading || query.isError ? "—" : total}
          </p>
        </div>
        {query.isFetching && !query.isLoading ? (
          <span className={styles.updating}>Updating…</span>
        ) : null}
      </section>

      <section className={`card ${styles.filterCard}`} aria-label="Recycle bin filters">
        <form
          key={`${filters.search || ""}-${filters.deleted_from || ""}-${filters.deleted_to || ""}`}
          className={styles.filterForm}
          onSubmit={handleFilterSubmit}
        >
          <label className={`field ${styles.searchField}`}>
            <span>Search work orders</span>
            <input
              className="input"
              name="search"
              placeholder="WO number, address, tenant, or technician"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Deleted from</span>
            <input
              className="input"
              type="date"
              name="deleted_from"
              defaultValue={filters.deleted_from || ""}
            />
          </label>
          <label className="field">
            <span>Deleted through</span>
            <input
              className="input"
              type="date"
              name="deleted_to"
              defaultValue={filters.deleted_to || ""}
            />
          </label>
          <div className={styles.filterActions}>
            <button className="btn btn-primary" type="submit">Apply filters</button>
            {filtersActive ? (
              <button className="btn" type="button" onClick={resetFilters}>Reset</button>
            ) : null}
          </div>
        </form>
        <div className={styles.rangeRow}>
          <span className={styles.rangeLabel}>Quick date range</span>
          <div className={styles.rangeOptions}>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`${styles.rangeButton} ${selectedRange === option.key || (!selectedRange && option.key === "all") ? styles.rangeButtonActive : ""}`}
                aria-pressed={selectedRange === option.key || (!selectedRange && option.key === "all")}
                onClick={() => applyRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <ErrorBanner error={query.error} />
      <ErrorBanner error={actionError} />

      <div className={styles.resultsBar}>
        <strong>
          {query.isError
            ? "Results unavailable"
            : `${total} ${total === 1 ? "work order" : "work orders"}`}
        </strong>
        <span>Sorted by most recently deleted</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Work order</th>
              <th>Property &amp; tenant</th>
              <th>Technician</th>
              <th>Work status</th>
              <th>Deleted</th>
              <th><span className={styles.visuallyHidden}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((wo) => (
              <tr key={wo.id}>
                <td>
                  <strong className={styles.workOrderNumber}>{wo.work_order_number}</strong>
                  <span className={styles.orderMeta}>Assigned {wo.date_assigned}</span>
                </td>
                <td>
                  <strong className={styles.address}>{wo.service_address}</strong>
                  <span className={styles.orderMeta}>{wo.tenant_names}</span>
                </td>
                <td>{wo.assigned_to_name}</td>
                <td><StatusBadge status={wo.status} /></td>
                <td className={styles.deletedAt}>{formatDeletedAt(wo.deleted_at)}</td>
                <td>
                  <div className={styles.actions}>
                    <button
                      className="btn"
                      type="button"
                      disabled={restore.isPending || permanentlyDelete.isPending}
                      onClick={() => {
                        setActionError(null);
                        restore.mutate(wo.id);
                      }}
                    >
                      Restore
                    </button>
                    <button
                      className={`btn ${styles.permanentButton}`}
                      type="button"
                      disabled={restore.isPending || permanentlyDelete.isPending}
                      onClick={() => setWorkOrderToDelete(wo)}
                    >
                      Delete permanently
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!query.isLoading && !query.isError && items.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  <strong>{filtersActive ? "No work orders match those filters" : "Your recycle bin is empty"}</strong>
                  <span>{filtersActive ? "Try widening the date range or changing your search." : "Deleted work orders will appear here."}</span>
                </td>
              </tr>
            ) : null}
            {query.isLoading ? (
              <tr><td colSpan={6} className={styles.emptyCell}>Loading recycle bin…</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileList}>
        {items.map((wo) => (
          <article className={`card ${styles.mobileCard}`} key={wo.id}>
            <div className={styles.mobileCardHeader}>
              <strong className={styles.workOrderNumber}>{wo.work_order_number}</strong>
              <StatusBadge status={wo.status} />
            </div>
            <strong className={styles.address}>{wo.service_address}</strong>
            <span className={styles.orderMeta}>Tenant: {wo.tenant_names}</span>
            <span className={styles.orderMeta}>Technician: {wo.assigned_to_name}</span>
            <span className={styles.deletedAt}>Deleted {formatDeletedAt(wo.deleted_at)}</span>
            <div className={styles.mobileActions}>
              <button
                className="btn"
                type="button"
                disabled={restore.isPending || permanentlyDelete.isPending}
                onClick={() => {
                  setActionError(null);
                  restore.mutate(wo.id);
                }}
              >
                Restore
              </button>
              <button
                className={`btn ${styles.permanentButton}`}
                type="button"
                disabled={restore.isPending || permanentlyDelete.isPending}
                onClick={() => setWorkOrderToDelete(wo)}
              >
                Delete permanently
              </button>
            </div>
          </article>
        ))}
        {!query.isLoading && !query.isError && items.length === 0 ? (
          <div className={styles.mobileEmpty}>
            <strong>{filtersActive ? "No matching work orders" : "Your recycle bin is empty"}</strong>
            <span>{filtersActive ? "Try widening the date range or changing your search." : "Deleted work orders will appear here."}</span>
          </div>
        ) : null}
      </div>

      <Pagination
        page={Math.max(0, Number(sp.get("page") || "0"))}
        totalPages={totalPages}
        onPageChange={setPage}
        disabled={query.isFetching}
      />

      <ConfirmDialog
        open={workOrderToDelete !== null}
        title="Permanently delete this work order?"
        message={
          workOrderToDelete
            ? `${workOrderToDelete.work_order_number} and its attachments will be permanently removed. This cannot be undone. The audit history will remain.`
            : ""
        }
        confirmLabel="Delete permanently"
        danger
        busy={permanentlyDelete.isPending}
        onCancel={() => setWorkOrderToDelete(null)}
        onConfirm={() => {
          if (!workOrderToDelete) return;
          setActionError(null);
          permanentlyDelete.mutate(workOrderToDelete.id);
        }}
      />
    </main>
  );
}
