import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listAdmins } from "../../api/endpoints";
import type { AuditLogFilters, AuditLogItem } from "../../api/types";
import { ErrorBanner, Pagination } from "../../components";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { queryKeys } from "../../lib/queryKeys";
import { useAuditLogsQuery, useAuditLogStatsQuery } from "./hooks/useAuditLogs";
import { AuditDetailModal } from "./components/AuditDetailModal";
import { AuditFilterForm } from "./components/AuditFilterForm";
import { AuditFilterPresets, type PresetKey } from "./components/AuditFilterPresets";
import { AuditMobileList } from "./components/AuditMobileList";
import { AuditStats } from "./components/AuditStats";
import { AuditTable } from "./components/AuditTable";
import styles from "./AuditLogView.module.css";

const PAGE_SIZE = 50;

export function AuditLogView() {
  const currentUser = useCurrentUser();
  const isOwner = currentUser.data?.role === "owner";
  const [sp, setSp] = useSearchParams();

  const search = sp.get("search") || "";
  const actorRole = sp.get("actor_role") || "";
  const actorId = sp.get("actor_id") ? Number(sp.get("actor_id")) : undefined;
  const entityType = sp.get("entity_type") || "";
  const dateFrom = sp.get("date_from") || "";
  const dateTo = sp.get("date_to") || "";
  const page = Math.max(0, Number(sp.get("page") || "0"));

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

  const filters: AuditLogFilters = {
    actor_id: actorId,
    actor_role: actorRole || undefined,
    entity_type: entityType || undefined,
    search: search || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const logsQuery = useAuditLogsQuery(filters, isOwner);
  const statsQuery = useAuditLogStatsQuery(isOwner);

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

  function handleFilterSubmit(values: {
    search: string;
    actor_id: string;
    actor_role: string;
    entity_type: string;
    date_from: string;
    date_to: string;
  }) {
    const next = new URLSearchParams();
    if (values.search) next.set("search", values.search);
    if (values.actor_role) next.set("actor_role", values.actor_role);
    if (values.actor_id) next.set("actor_id", values.actor_id);
    if (values.entity_type) next.set("entity_type", values.entity_type);
    if (values.date_from) next.set("date_from", values.date_from);
    if (values.date_to) next.set("date_to", values.date_to);
    setSp(next, { replace: true });
  }

  function resetFilters() {
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
  const totalPages = Math.ceil(total / PAGE_SIZE);

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

      <AuditStats stats={statsQuery.data} />

      <AuditFilterPresets currentPreset={currentPreset} onSelectPreset={applyPreset} />

      <AuditFilterForm
        admins={adminsQuery.data}
        search={search}
        actorId={actorId}
        actorRole={actorRole}
        dateFrom={dateFrom}
        dateTo={dateTo}
        currentEntityType={entityType}
        onSubmit={handleFilterSubmit}
        onReset={resetFilters}
      />

      <ErrorBanner error={logsQuery.error} />
      <ErrorBanner error={statsQuery.error} />

      <div className={styles.resultsBar}>
        <span>
          Showing {items.length > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} events
        </span>
        {logsQuery.isFetching ? <span>Updating…</span> : null}
      </div>

      <AuditTable items={items} isLoading={logsQuery.isLoading} onInspect={setSelectedLog} />

      <AuditMobileList items={items} isLoading={logsQuery.isLoading} onInspect={setSelectedLog} />

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </main>
  );
}
