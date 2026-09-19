import { apiBlob, apiJson, apiRequest, downloadBlob, qs } from "./client";
import type {
  ChecklistCategory,
  CompleteWorkOrderRequest,
  MessageResponse,
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

export async function downloadManagerPdf(id: number) {
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
  payload: { details?: string; resolved?: boolean; category?: string },
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
