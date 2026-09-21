import { useState, type FormEvent } from "react";
import type { AdminUser } from "../../../api/types";
import styles from "./AuditFilterForm.module.css";

interface AuditFilterFormProps {
  admins?: AdminUser[];
  search: string;
  actorId?: number;
  actorRole?: string;
  dateFrom?: string;
  dateTo?: string;
  onSubmit: (filters: {
    search: string;
    actor_id: string;
    actor_role: string;
    entity_type: string;
    date_from: string;
    date_to: string;
  }) => void;
  onReset: () => void;
  currentEntityType?: string;
}

export function AuditFilterForm({
  admins = [],
  search,
  actorId,
  actorRole = "",
  dateFrom = "",
  dateTo = "",
  onSubmit,
  onReset,
  currentEntityType = "",
}: AuditFilterFormProps) {
  const [searchInput, setSearchInput] = useState(search);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      search: searchInput.trim(),
      actor_id: String(fd.get("actor_id") || "").trim(),
      actor_role: String(fd.get("actor_role") || "").trim(),
      entity_type: currentEntityType,
      date_from: String(fd.get("date_from") || "").trim(),
      date_to: String(fd.get("date_to") || "").trim(),
    });
  }

  function handleReset() {
    setSearchInput("");
    onReset();
  }

  return (
    <form className={`card ${styles.filtersCard}`} onSubmit={handleSubmit}>
      <div className={styles.filterRow}>
        <label className="field">
          <span>Search</span>
          <input
            className="input"
            name="search"
            placeholder="Search WO#, admin, address, details…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Actor / Admin</span>
          <select className="select" name="actor_id" defaultValue={actorId ? String(actorId) : ""}>
            <option value="">All team members</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name} ({admin.role})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Role</span>
          <select className="select" name="actor_role" defaultValue={actorRole}>
            <option value="">All roles</option>
            <option value="admin">Office Admin</option>
            <option value="owner">Owner</option>
          </select>
        </label>

        <label className="field">
          <span>Date from</span>
          <input className="input" type="date" name="date_from" defaultValue={dateFrom} />
        </label>

        <label className="field">
          <span>Date to</span>
          <input className="input" type="date" name="date_to" defaultValue={dateTo} />
        </label>

        <div className={styles.filterActions}>
          <button className="btn btn-primary" type="submit">
            Filter
          </button>
          <button className="btn" type="button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>
    </form>
  );
}
