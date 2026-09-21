import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getAuditLogStats, listAdmins, listAuditLogs } from "../api/endpoints";
import type { AuditLogFilters, AuditLogItem } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner/ErrorBanner";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatRelativeTime, formatStamp } from "../lib/format";
import { queryKeys } from "../lib/queryKeys";
import styles from "./AuditLogPage.module.css";

type PresetKey = "all" | "admin_only" | "work_orders" | "categories" | "team" | "logins";

function renderActionBadge(action: string) {
  switch (action) {
    case "work_order.create":
      return <span className={styles.badgeSuccess}>WO Created</span>;
    case "work_order.update":
      return <span className={styles.badgeWarning}>WO Updated</span>;
    case "work_order.delete":
      return <span className={styles.badgeDanger}>WO Deleted</span>;
    case "work_order.resend_link":
      return <span className={styles.badgeWarning}>Link Resent</span>;
    case "work_order.regenerate_link":
      return <span className={styles.badgeWarning}>Link Regenerated</span>;
    case "category.create":
      return <span className={styles.badgeSuccess}>Category Added</span>;
    case "category.archive":
      return <span className={styles.badgeDanger}>Category Archived</span>;
    case "admin.create":
      return <span className={styles.badgeSuccess}>Admin Added</span>;
    case "admin.delete":
      return <span className={styles.badgeDanger}>Admin Removed</span>;
    case "auth.login":
      return <span className={styles.badgeNeutral}>Logged In</span>;
    case "auth.register_owner":
      return <span className={styles.badgeSuccess}>Owner Registered</span>;
    default:
      return <span className={styles.badgeNeutral}>{action}</span>;
  }
}

export function AuditLogPage() {
  const currentUser = useCurrentUser();
  const isOwner = currentUser.data?.role === "owner";
  const [sp, setSp] = useSearchParams();

  // Search & Filter state synced with URLSearchParams
  const search = sp.get("search") || "";
  const actorRole = sp.get("actor_role") || "";
  const actorId = sp.get("actor_id") ? Number(sp.get("actor_id")) : undefined;
  const entityType = sp.get("entity_type") || "";
  const dateFrom = sp.get("date_from") || "";
  const dateTo = sp.get("date_to") || "";
  const page = Math.max(0, Number(sp.get("page") || "0"));
  const limit = 50;

  // Selected preset detection
  let currentPreset: PresetKey = "all";
  if (actorRole === "admin" && !entityType) {
    currentPreset = "admin_only";
  } else if (entityType === "work_order") {
    currentPreset = "work_orders";
  } else if (entityType === "checklist_category") {
    currentPreset = "categories";
  } else if (entityType === "admin_user") {
    currentPreset = "team";
  } else if (entityType === "user_session") {
    currentPreset = "logins";
  }

  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  const filters: AuditLogFilters = {
    actor_id: actorId,
    actor_role: actorRole || undefined,
    entity_type: entityType || undefined,
    search: search || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    limit,
    offset: page * limit,
  };

  const logsQuery = useQuery({
    queryKey: queryKeys.auditLogs(filters),
    queryFn: () => listAuditLogs(filters),
    enabled: isOwner,
  });

  const statsQuery = useQuery({
    queryKey: queryKeys.auditLogStats,
    queryFn: getAuditLogStats,
    enabled: isOwner,
  });

  const adminsQuery = useQuery({
    queryKey: queryKeys.admins,
    queryFn: listAdmins,
    enabled: isOwner,
  });

  function applyPreset(preset: PresetKey) {
    const next = new URLSearchParams(sp);
    next.delete("page");

    if (preset === "all") {
      next.delete("actor_role");
      next.delete("entity_type");
    } else if (preset === "admin_only") {
      next.set("actor_role", "admin");
      next.delete("entity_type");
    } else if (preset === "work_orders") {
      next.delete("actor_role");
      next.set("entity_type", "work_order");
    } else if (preset === "categories") {
      next.delete("actor_role");
      next.set("entity_type", "checklist_category");
    } else if (preset === "team") {
      next.delete("actor_role");
      next.set("entity_type", "admin_user");
    } else if (preset === "logins") {
      next.delete("actor_role");
      next.set("entity_type", "user_session");
    }
    setSp(next, { replace: true });
  }

  function handleFilterSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = new URLSearchParams();

    const q = String(fd.get("search") || "").trim();
    const role = String(fd.get("actor_role") || "").trim();
    const actor = String(fd.get("actor_id") || "").trim();
    const entity = String(fd.get("entity_type") || "").trim();
    const dFrom = String(fd.get("date_from") || "").trim();
    const dTo = String(fd.get("date_to") || "").trim();

    if (q) next.set("search", q);
    if (role) next.set("actor_role", role);
    if (actor) next.set("actor_id", actor);
    if (entity) next.set("entity_type", entity);
    if (dFrom) next.set("date_from", dFrom);
    if (dTo) next.set("date_to", dTo);

    setSp(next, { replace: true });
  }

  function resetFilters() {
    setSearchInput("");
    setSp(new URLSearchParams(), { replace: true });
  }

  function setPage(newPage: number) {
    const next = new URLSearchParams(sp);
    if (newPage <= 0) {
      next.delete("page");
    } else {
      next.set("page", String(newPage));
    }
    setSp(next, { replace: true });
  }

  if (!currentUser.isLoading && !isOwner) {
    return (
      <main className="page stack">
        <h1>Access restricted</h1>
        <p className={styles.subtitle}>
          Only the Account Owner has authorization to view administrative activity and audit logs.
        </p>
      </main>
    );
  }

  const items = logsQuery.data?.items || [];
  const total = logsQuery.data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <main className="page page-wide stack">
      <div className={styles.header}>
        <div>
          <h1>Audit &amp; Activity Log</h1>
          <p className={styles.subtitle}>
            Monitor and audit all administrative operations performed by office admins across work orders, categories, and account access.
          </p>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              void logsQuery.refetch();
              void statsQuery.refetch();
            }}
          >
            Refresh
          </button>
          <Link className="btn" to="/settings/admins">
            Manage admins
          </Link>
        </div>
      </div>

      <div className={styles.ownerBanner}>
        <div>
          <div className={styles.ownerBannerTitle}>
            Account Owner Overview: {currentUser.data?.name}
          </div>
          <div className={styles.ownerBannerDesc}>
            All actions executed by administrators are permanently logged below with date, actor identity, action type, and details.
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Audit Events</span>
          <span className={styles.statValue}>{statsQuery.data?.total_events ?? "—"}</span>
          <span className={styles.statDesc}>Historical records captured</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Admin Actions Today</span>
          <span className={styles.statValue}>{statsQuery.data?.admin_actions_today ?? "—"}</span>
          <span className={styles.statDesc}>Operations by admins since 00:00 UTC</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Work Order Operations</span>
          <span className={styles.statValue}>{statsQuery.data?.work_order_actions ?? "—"}</span>
          <span className={styles.statDesc}>Created, updated, or resent</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active Office Admins</span>
          <span className={styles.statValue}>{statsQuery.data?.unique_active_admins ?? "—"}</span>
          <span className={styles.statDesc}>Admins with recorded activity</span>
        </div>
      </div>

      {/* Quick Filter Presets */}
      <div className={styles.presetsBar}>
        <button
          type="button"
          className={`${styles.presetBtn} ${currentPreset === "all" ? styles.presetActive : ""}`}
          onClick={() => applyPreset("all")}
        >
          All Activity
        </button>
        <button
          type="button"
          className={`${styles.presetBtn} ${currentPreset === "admin_only" ? styles.presetActive : ""}`}
          onClick={() => applyPreset("admin_only")}
        >
          👤 Admin Operations Only
        </button>
        <button
          type="button"
          className={`${styles.presetBtn} ${currentPreset === "work_orders" ? styles.presetActive : ""}`}
          onClick={() => applyPreset("work_orders")}
        >
          📋 Work Orders
        </button>
        <button
          type="button"
          className={`${styles.presetBtn} ${currentPreset === "categories" ? styles.presetActive : ""}`}
          onClick={() => applyPreset("categories")}
        >
          🏷️ Categories
        </button>
        <button
          type="button"
          className={`${styles.presetBtn} ${currentPreset === "team" ? styles.presetActive : ""}`}
          onClick={() => applyPreset("team")}
        >
          👥 Admin Team
        </button>
        <button
          type="button"
          className={`${styles.presetBtn} ${currentPreset === "logins" ? styles.presetActive : ""}`}
          onClick={() => applyPreset("logins")}
        >
          🔑 Sign-ins
        </button>
      </div>

      {/* Filter form */}
      <form className={`card ${styles.filtersCard}`} onSubmit={handleFilterSubmit}>
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
              {(adminsQuery.data || []).map((admin) => (
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
            <button className="btn" type="button" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </div>
      </form>

      <ErrorBanner error={logsQuery.error} />
      <ErrorBanner error={statsQuery.error} />

      <div className={styles.resultsBar}>
        <span>
          Showing {items.length > 0 ? page * limit + 1 : 0}–{Math.min((page + 1) * limit, total)} of {total} events
        </span>
        {logsQuery.isFetching ? <span>Updating…</span> : null}
      </div>

      {/* Desktop Table View */}
      <div className={`card ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Description</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((log) => {
              const isLogOwner = log.actor_role === "owner";
              return (
                <tr key={log.id}>
                  <td className={styles.timeCol}>
                    <div className={styles.timePrimary}>{formatRelativeTime(log.created_at)}</div>
                    <div className={styles.timeSub}>{formatStamp(log.created_at)}</div>
                  </td>
                  <td className={styles.actorCol}>
                    <div className={styles.actorName}>{log.actor_name}</div>
                    <div className={styles.actorEmail}>{log.actor_email}</div>
                    <span className={isLogOwner ? styles.badgeRoleOwner : styles.badgeRoleAdmin}>
                      {isLogOwner ? "Owner" : "Admin"}
                    </span>
                  </td>
                  <td>{renderActionBadge(log.action)}</td>
                  <td>
                    {log.entity_type === "work_order" && log.entity_id ? (
                      <Link to={`/work-orders/${log.entity_id}`} className={`mono ${styles.targetLink}`}>
                        {log.entity_name || `WO #${log.entity_id}`}
                      </Link>
                    ) : (
                      <span className="mono">{log.entity_name || log.entity_type}</span>
                    )}
                  </td>
                  <td className={styles.descCol}>{log.description}</td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "0 10px", minHeight: "32px", fontSize: "13px" }}
                      onClick={() => setSelectedLog(log)}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && !logsQuery.isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "32px 16px", color: "var(--ink-soft)" }}>
                  No audit logs found matching your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
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
                  {renderActionBadge(log.action)}
                </div>
              </div>
              <div className={styles.mobileCardDesc}>{log.description}</div>
              <div className={styles.mobileCardFooter}>
                <span>{formatRelativeTime(log.created_at)}</span>
                <button
                  type="button"
                  className="btn"
                  style={{ minHeight: "32px", padding: "0 12px", fontSize: "12px" }}
                  onClick={() => setSelectedLog(log)}
                >
                  View Details
                </button>
              </div>
            </article>
          );
        })}
        {items.length === 0 && !logsQuery.isLoading ? (
          <div className="card" style={{ textAlign: "center", padding: "24px 16px", color: "var(--ink-soft)" }}>
            No audit logs found matching your filters.
          </div>
        ) : null}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 ? (
        <div className={styles.paginationBar}>
          <span className={styles.pageInfo}>
            Page {page + 1} of {totalPages}
          </span>
          <div className={styles.pageButtons}>
            <button
              type="button"
              className="btn"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {/* Detailed Modal Dialog */}
      {selectedLog ? (
        <div className={styles.modalBackdrop} onClick={() => setSelectedLog(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Audit Event #{selectedLog.id}</h2>
                <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
                  {formatStamp(selectedLog.created_at)} ({formatRelativeTime(selectedLog.created_at)})
                </span>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedLog(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailItemLabel}>Admin / Actor</span>
                <span className={styles.detailItemValue}>
                  {selectedLog.actor_name} ({selectedLog.actor_role})
                </span>
                <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>{selectedLog.actor_email}</span>
              </div>

              <div className={styles.detailItem}>
                <span className={styles.detailItemLabel}>Action Code</span>
                <div style={{ marginTop: 4 }}>{renderActionBadge(selectedLog.action)}</div>
                <span className="mono" style={{ fontSize: "11px", color: "var(--ink-soft)", marginTop: 2 }}>
                  {selectedLog.action}
                </span>
              </div>

              <div className={styles.detailItem}>
                <span className={styles.detailItemLabel}>Target Resource</span>
                <span className={styles.detailItemValue}>
                  {selectedLog.entity_name || selectedLog.entity_id || selectedLog.entity_type}
                </span>
                <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>Type: {selectedLog.entity_type}</span>
              </div>

              <div className={styles.detailItem}>
                <span className={styles.detailItemLabel}>Client IP Address</span>
                <span className="mono" style={{ fontSize: "13px", marginTop: 4 }}>
                  {selectedLog.ip_address || "Internal / Not captured"}
                </span>
              </div>
            </div>

            <div>
              <span className={styles.detailItemLabel}>Event Summary</span>
              <p style={{ marginTop: 4, fontSize: "15px", lineHeight: "1.4" }}>{selectedLog.description}</p>
            </div>

            {selectedLog.parsed_details ? (
              <div>
                <span className={styles.detailItemLabel}>Metadata / Payload Details</span>
                <pre className={styles.detailJsonBox}>
                  {JSON.stringify(selectedLog.parsed_details, null, 2)}
                </pre>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              {selectedLog.entity_type === "work_order" && selectedLog.entity_id ? (
                <Link
                  className="btn btn-primary"
                  to={`/work-orders/${selectedLog.entity_id}`}
                  onClick={() => setSelectedLog(null)}
                >
                  Open Work Order
                </Link>
              ) : null}
              <button type="button" className="btn" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
