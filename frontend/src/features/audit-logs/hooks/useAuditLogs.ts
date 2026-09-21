import { useQuery } from "@tanstack/react-query";
import { getAuditLogStats, listAuditLogs } from "../../../api/endpoints";
import type { AuditLogFilters } from "../../../api/types";
import { queryKeys } from "../../../lib/queryKeys";

export function useAuditLogsQuery(filters: AuditLogFilters, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.auditLogs(filters),
    queryFn: () => listAuditLogs(filters),
    enabled,
  });
}

export function useAuditLogStatsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.auditLogStats,
    queryFn: getAuditLogStats,
    enabled,
  });
}
