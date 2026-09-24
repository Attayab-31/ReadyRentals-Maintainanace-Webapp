export type Priority = "emergency" | "urgent" | "standard";

export type WorkOrderStatus =
  | "assigned"
  | "in_progress"
  | "completed_pending_signoff"
  | "signed_off";

export interface PriorityInfo {
  id: number;
  code: Priority;
  name: string;
  hour_target: number;
}

export interface WorkOrderItem {
  id: number;
  category: string;
  details: string;
  tech_notes: string;
  before_photo_url: string | null;
  after_photo_url: string | null;
  before_photo_skipped: boolean;
  after_photo_skipped: boolean;
  resolved: boolean;
  sort_order: number;
  work_order_id?: number;
}

export interface WorkOrder {
  id: number;
  work_order_number: string;
  created_by_user_id?: number;
  created_by_name?: string | null;
  created_by_email?: string | null;
  assigned_to_name: string;
  assigned_to_phone: string;
  assigned_to_email?: string | null;
  worker_notified_at?: string | null;
  worker_notify_error?: string | null;
  worker_email_notified_at?: string | null;
  worker_email_notify_error?: string | null;
  date_assigned: string;
  service_address: string;
  tenant_names: string;
  tenant_phone: string | null;
  priority: PriorityInfo;
  status: WorkOrderStatus;
  service_date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  within_target: boolean | null;
  if_incomplete_explanation: string | null;
  entire_unit_inspected: boolean | null;
  inspection_results: string | null;
  tenant_signature_url: string | null;
  tenant_signature_name: string | null;
  tenant_signature_at: string | null;
  tech_signature_url: string | null;
  tech_signature_name: string | null;
  tech_signature_at: string | null;
  worker_access_token?: string;
  worker_share_url?: string | null;
  pdf_url: string | null;
  items: WorkOrderItem[];
  created_at?: string;
  updated_at?: string;
}

export interface WorkerWorkOrder {
  work_order_number: string;
  status: WorkOrderStatus;
  assigned_to_name: string;
  date_assigned: string;
  service_address: string;
  tenant_names: string;
  tenant_phone: string | null;
  priority: PriorityInfo | null;
  service_date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  within_target: boolean | null;
  items: WorkOrderItem[];
  if_incomplete_explanation: string | null;
  entire_unit_inspected: boolean | null;
  inspection_results: string | null;
  tenant_signature_name: string | null;
  tenant_signature_at: string | null;
  tenant_signature_url: string | null;
  tenant_signed: boolean;
  tech_signature_name: string | null;
  tech_signature_at: string | null;
  tech_signature_url: string | null;
  tech_signed: boolean;
  pdf_url: string | null;
  tenant_disclaimer?: string;
}

export interface WorkOrderItemCreate {
  category: string;
  details: string;
  resolved?: boolean;
}

export interface WorkOrderCreate {
  assigned_to_name: string;
  assigned_to_phone: string;
  assigned_to_email?: string | null;
  date_assigned: string;
  service_address: string;
  tenant_names: string;
  tenant_phone?: string | null;
  priority: Priority;
  service_date?: string | null;
  items: WorkOrderItemCreate[];
}

export interface WorkOrderUpdate {
  assigned_to_name?: string;
  assigned_to_phone?: string;
  date_assigned?: string;
  service_address?: string;
  tenant_names?: string;
  tenant_phone?: string | null;
  priority?: Priority;
  service_date?: string | null;
  items?: WorkOrderItemCreate[];
}

export interface WorkOrderListFilters {
  status?: WorkOrderStatus;
  address?: string;
  overdue?: true;
  date_from?: string;
  date_to?: string;
  assigned_by_id?: number;
}

export type UserRole = "owner" | "admin";

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  work_orders_count: number;
}

export interface AdminCreate {
  name: string;
  email: string;
  password: string;
}

export interface RegisterOwnerRequest {
  name: string;
  email: string;
  password: string;
  owner_code: string;
}

export interface ChecklistCategory {
  id: number;
  name: string;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface CompleteWorkOrderRequest {
  entire_unit_inspected: boolean;
  inspection_results?: string | null;
  if_incomplete_explanation?: string | null;
}

export interface SaveProgressRequest {
  entire_unit_inspected?: boolean | null;
  inspection_results?: string | null;
}

export interface SignRequest {
  signer: "tenant" | "tech";
  name: string;
  signature_png_base64: string;
}

export interface MessageResponse {
  detail: string;
}

export const HOUR_TARGETS: Record<Priority, number> = {
  emergency: 4,
  urgent: 24,
  standard: 72,
};

export interface AuditLogItem {
  id: number;
  created_at: string;
  actor_id: number | null;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  description: string;
  details: string | null;
  parsed_details: Record<string, unknown> | null;
  ip_address: string | null;
}

export interface AuditLogListResponse {
  items: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogStats {
  total_events: number;
  admin_actions_today: number;
  work_order_actions: number;
  unique_active_admins: number;
  action_breakdown: Record<string, number>;
}

export interface AuditLogFilters {
  actor_id?: number;
  actor_role?: string;
  action?: string;
  entity_type?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}
