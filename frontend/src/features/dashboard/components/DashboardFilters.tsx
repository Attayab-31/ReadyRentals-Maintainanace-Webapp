import { useRef, type FormEvent } from "react";
import type { AdminUser, CurrentUser, WorkOrderListFilters, WorkOrderStatus } from "../../../api/types";
import styles from "./DashboardFilters.module.css";

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

interface DashboardFiltersProps {
  filters: WorkOrderListFilters;
  isOwner: boolean;
  admins?: AdminUser[];
  currentUser?: CurrentUser | null;
  onFilterSubmit: (formData: FormData) => void;
  onToggleMyOnly: () => void;
  onReset: () => void;
  isMyOnlyActive: boolean;
}

export function DashboardFilters({
  filters,
  isOwner,
  admins = [],
  currentUser,
  onFilterSubmit,
  onToggleMyOnly,
  onReset,
  isMyOnlyActive,
}: DashboardFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onFilterSubmit(new FormData(e.currentTarget));
  }

  function handleReset() {
    if (formRef.current) {
      formRef.current.reset();
    }
    onReset();
  }

  const hasActiveFilters = Boolean(
    filters.status ||
    filters.address ||
    filters.overdue ||
    filters.date_from ||
    filters.date_to ||
    filters.assigned_by_id
  );

  return (
    <form ref={formRef} className={`card ${styles.filters}`} onSubmit={handleSubmit}>
      <label className="field">
        <span>Status</span>
        <select className="select" name="status" defaultValue={filters.status || ""}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      {isOwner && admins.length > 0 ? (
        <label className="field">
          <span>Assigned by</span>
          <select
            className="select"
            name="assigned_by_id"
            defaultValue={filters.assigned_by_id ? String(filters.assigned_by_id) : ""}
          >
            <option value="">All assigners</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name} ({admin.role})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="field">
        <span>Address</span>
        <input
          className="input"
          name="address"
          defaultValue={filters.address || ""}
          placeholder="Filter by address"
        />
      </label>

      <label className="field">
        <span>Date from</span>
        <input className="input" type="date" name="date_from" defaultValue={filters.date_from || ""} />
      </label>

      <label className="field">
        <span>Date to</span>
        <input className="input" type="date" name="date_to" defaultValue={filters.date_to || ""} />
      </label>

      <div className={styles.filterActions}>
        {currentUser ? (
          <button
            type="button"
            className={`btn ${isMyOnlyActive ? "btn-primary " + styles.myOrdersActive : styles.myOrdersBtn}`}
            onClick={onToggleMyOnly}
          >
            {isMyOnlyActive ? "Showing my orders" : "My work orders"}
          </button>
        ) : null}
        <button className={`btn btn-primary ${styles.filterBtn}`} type="submit">
          Filter
        </button>
        {hasActiveFilters ? (
          <button className={`btn ${styles.resetBtn}`} type="button" onClick={handleReset}>
            Reset
          </button>
        ) : null}
      </div>
    </form>
  );
}
