import type { AuditLogFilters, RecycleBinFilters, WorkOrderListFilters } from "../api/types";

export const queryKeys = {
  categories: ["checklist-categories"] as const,
  admins: ["admins"] as const,
  currentUser: ["auth", "me"] as const,
  workOrders: (filters: WorkOrderListFilters) => ["work-orders", filters] as const,
  workOrder: (id: number) => ["work-order", id] as const,
  recycleBin: (filters: RecycleBinFilters) => ["work-order-recycle-bin", filters] as const,
  worker: (token: string) => ["wo", token] as const,
  auditLogs: (filters?: AuditLogFilters) => ["audit-logs", filters] as const,
  auditLogStats: ["audit-logs", "stats"] as const,
};
