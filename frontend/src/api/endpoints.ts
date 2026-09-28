import { apiBlob, apiJson, apiRequest, downloadBlob, qs } from "./client";
import type {
  AdminCreate,
  AdminUser,
  AuditLogFilters,
  AuditLogListResponse,
  AuditLogStats,
  ChecklistCategory,
  CompleteWorkOrderRequest,
  CurrentUser,
  MessageResponse,
  RegisterOwnerRequest,
  SaveProgressRequest,
  SignRequest,
  TokenResponse,
  WorkOrder,
  WorkOrderCreate,
  WorkOrderItem,
  WorkOrderListFilters,
  WorkOrderUpdate,
  WorkerWorkOrder,
} from "./types";

export function login(email: string, password: string) {
  return apiJson<TokenResponse>("/auth/login", {
    method: "POST",
    json: { email, password },
  });
}

export function registerOwner(payload: RegisterOwnerRequest) {
  return apiJson<TokenResponse>("/auth/register-owner", {
    method: "POST",
    json: payload,
  });
}

export function getOwnerSetupStatus() {
  return apiJson<{ available: boolean }>("/auth/owner-setup-status");
}

export function getCurrentUser() {
  return apiJson<CurrentUser>("/auth/me", { auth: true });
}

export function listAdmins() {
  return apiJson<AdminUser[]>("/admins", { auth: true });
}

export function createAdmin(payload: AdminCreate) {
  return apiJson<AdminUser>("/admins", {
    auth: true,
    method: "POST",
    json: payload,
  });
}

export function deleteAdmin(id: number) {
  return apiJson<MessageResponse>(`/admins/${id}`, {
    auth: true,
    method: "DELETE",
  });
}

export function listAuditLogs(filters?: AuditLogFilters) {
  return apiJson<AuditLogListResponse>(
    `/audit-logs${qs({
      actor_id: filters?.actor_id,
      actor_role: filters?.actor_role,
      action: filters?.action,
      entity_type: filters?.entity_type,
      search: filters?.search,
      date_from: filters?.date_from,
      date_to: filters?.date_to,
      limit: filters?.limit,
      offset: filters?.offset,
    })}`,
    { auth: true },
  );
}

export function getAuditLogStats() {
  return apiJson<AuditLogStats>("/audit-logs/stats", { auth: true });
}

export function listCategories() {
  return apiJson<ChecklistCategory[]>("/checklist-categories", { auth: true });
}

export function createCategory(name: string) {
  return apiJson<ChecklistCategory>("/checklist-categories", {
    auth: true,
    method: "POST",
    json: { name },
  });
}

export function archiveCategory(id: number) {
  return apiJson<MessageResponse>(`/checklist-categories/${id}`, {
    auth: true,
    method: "DELETE",
  });
}

export function listWorkOrders(filters: WorkOrderListFilters) {
  return apiJson<WorkOrder[]>(
    `/work-orders${qs({
      status: filters.status,
      address: filters.address,
      overdue: filters.overdue ? "true" : undefined,
      date_from: filters.date_from,
      date_to: filters.date_to,
      assigned_by_id: filters.assigned_by_id ? String(filters.assigned_by_id) : undefined,
    })}`,
    { auth: true },
  );
}

export function getWorkOrder(id: number) {
  return apiJson<WorkOrder>(`/work-orders/${id}`, { auth: true });
}

export function createWorkOrder(payload: WorkOrderCreate) {
  return apiJson<WorkOrder>("/work-orders", { auth: true, method: "POST", json: payload });
}

export function patchWorkOrder(id: number, payload: WorkOrderUpdate) {
  return apiJson<WorkOrder>(`/work-orders/${id}`, { auth: true, method: "PATCH", json: payload });
}

export function deleteWorkOrder(id: number) {
  return apiJson<MessageResponse>(`/work-orders/${id}`, { auth: true, method: "DELETE" });
}

export function resendWorkOrder(id: number) {
  return apiJson<MessageResponse>(`/work-orders/${id}/resend`, { auth: true, method: "POST" });
}

export async function downloadWorkOrderPdf(id: number) {
  const { blob, filename } = await apiBlob(`/work-orders/${id}/pdf`, true);
  downloadBlob(blob, filename);
}

export function getWorkerWorkOrder(token: string) {
  return apiJson<WorkerWorkOrder>(`/wo/${token}`);
}

export function startJob(token: string) {
  return apiJson<WorkerWorkOrder>(`/wo/${token}/start`, { method: "POST" });
}

export function patchWorkerItem(
  token: string,
  itemId: number,
  payload: {
    tech_notes?: string;
    resolved?: boolean;
    category?: string;
    before_photo_skipped?: boolean;
    after_photo_skipped?: boolean;
  },
) {
  return apiJson<WorkOrderItem>(`/wo/${token}/items/${itemId}`, {
    method: "PATCH",
    json: payload,
  });
}

export function uploadItemPhoto(token: string, itemId: number, slot: "before" | "after", file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest<WorkOrderItem>(`/wo/${token}/items/${itemId}/photo?slot=${slot}`, {
    method: "POST",
    body,
  });
}

export function deleteItemPhoto(token: string, itemId: number, slot: "before" | "after") {
  return apiJson<WorkOrderItem>(`/wo/${token}/items/${itemId}/photo?slot=${slot}`, {
    method: "DELETE",
  });
}

export function saveProgress(token: string, payload: SaveProgressRequest) {
  return apiJson<WorkerWorkOrder>(`/wo/${token}/progress`, { method: "POST", json: payload });
}

export function completeJob(token: string, payload: CompleteWorkOrderRequest) {
  return apiJson<WorkerWorkOrder>(`/wo/${token}/complete`, { method: "POST", json: payload });
}

export function signJob(token: string, payload: SignRequest) {
  return apiJson<WorkerWorkOrder>(`/wo/${token}/sign`, { method: "POST", json: payload });
}

export async function downloadWorkerPdf(token: string) {
  const { blob, filename } = await apiBlob(`/wo/${token}/pdf`);
  downloadBlob(blob, filename);
}
