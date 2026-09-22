import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Priority } from "../../api/types";
import {
  BottomActionBar,
  ConfirmDialog,
  ErrorBanner,
  LoadingState,
  PriorityBadge,
  SignatureDisplayCard,
  SignaturesGrid,
  StatusBadge,
  WorkOrderItemSummary,
} from "../../components";
import { formatDuration, formatStamp } from "../../lib/format";
import { frontendWorkerLink, shareOrCopy } from "../../lib/share";
import { useToast } from "../../hooks/useToast";
import {
  useDeleteWorkOrderMutation,
  usePatchWorkOrderMutation,
  useResendWorkOrderMutation,
  useWorkOrderDetailQuery,
} from "./hooks/useWorkOrders";
import { WorkOrderInfoPanel } from "./components/WorkOrderInfoPanel";
import { WorkOrderSummaryGrid } from "./components/WorkOrderSummaryGrid";
import styles from "./WorkOrderDetailView.module.css";

export function WorkOrderDetailView() {
  const { id } = useParams();
  const woId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [banner, setBanner] = useState<unknown>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const query = useWorkOrderDetailQuery(woId);

  const patch = usePatchWorkOrderMutation(woId, {
    onSuccess: () => {
      setIsEditing(false);
      toast("Work order updated");
    },
    onError: setBanner,
  });

  const resend = useResendWorkOrderMutation(woId, {
    onError: setBanner,
  });

  const remove = useDeleteWorkOrderMutation({
    onSuccess: () => {
      setDeleteOpen(false);
      navigate("/dashboard");
    },
    onError: (err) => {
      setDeleteOpen(false);
      setBanner(err);
    },
  });

  const wo = query.data;

  const scheduleSummary = wo
    ? wo.start_time || wo.end_time
      ? `${wo.start_time ? formatStamp(wo.start_time) : "Not started"} → ${
          wo.end_time ? formatStamp(wo.end_time) : "Open"
        }`
      : "Not scheduled"
    : "Not scheduled";

  const slaSummary = wo
    ? wo.within_target == null
      ? wo.duration_minutes == null
        ? "Pending"
        : `${formatDuration(wo.duration_minutes)} • Pending`
      : `${
          wo.duration_minutes == null
            ? "No duration logged"
            : formatDuration(wo.duration_minutes)
        } • ${wo.within_target ? "Within target" : "Over target"}`
    : "Pending";

  async function handleSave(e?: FormEvent) {
    e?.preventDefault();
    if (!wo || !isEditing || !formRef.current) return;
    const fd = new FormData(formRef.current);
    setBanner(null);
    patch.mutate({
      assigned_to_name: String(fd.get("assigned_to_name") || ""),
      assigned_to_phone: String(fd.get("assigned_to_phone") || ""),
      date_assigned: String(fd.get("date_assigned") || ""),
      service_address: String(fd.get("service_address") || ""),
      tenant_names: String(fd.get("tenant_names") || ""),
      tenant_phone: String(fd.get("tenant_phone") || "") || null,
      priority: String(fd.get("priority") || "standard") as Priority,
    });
  }

  function handleCancelEdit() {
    if (formRef.current) {
      formRef.current.reset();
    }
    setIsEditing(false);
  }

  return (
    <main className="page stack">
      <ErrorBanner error={query.error} />
      <ErrorBanner error={banner} />

      {query.isLoading && !wo ? (
        <LoadingState message="Loading work order details…" minHeight="40vh" />
      ) : null}

      {wo ? (
        <>
          <div className={styles.headerRow}>
            <div className={styles.titleArea}>
              <h1 className="mono">{wo.work_order_number}</h1>
              {isEditing ? (
                <span className={styles.editModeBadge}>Editing</span>
              ) : null}
            </div>
            <div className={styles.badges}>
              <StatusBadge status={wo.status} />
              <PriorityBadge priority={wo.priority} />
            </div>
          </div>

          <form ref={formRef} className="card stack" onSubmit={handleSave}>
            <div className={styles.fieldGrid}>
              <label className="field">
                <span>Technician name</span>
                <input
                  className="input"
                  name="assigned_to_name"
                  defaultValue={wo.assigned_to_name}
                  disabled={!isEditing}
                />
              </label>
              <label className="field">
                <span>Technician phone</span>
                <input
                  className="input"
                  name="assigned_to_phone"
                  defaultValue={wo.assigned_to_phone}
                  disabled={!isEditing}
                />
              </label>
              <label className="field">
                <span>Assigned by</span>
                <input
                  className="input"
                  defaultValue={wo.created_by_name || "Office"}
                  disabled
                />
              </label>
              <label className="field">
                <span>Assigned date</span>
                <input
                  className="input"
                  type="date"
                  name="date_assigned"
                  defaultValue={wo.date_assigned}
                  disabled={!isEditing}
                />
              </label>
              <label className="field">
                <span>Property address</span>
                <input
                  className="input"
                  name="service_address"
                  defaultValue={wo.service_address}
                  disabled={!isEditing}
                />
              </label>
              <label className="field">
                <span>Priority</span>
                <select
                  className="select"
                  name="priority"
                  defaultValue={wo.priority.code}
                  disabled={!isEditing}
                >
                  <option value="emergency">Emergency</option>
                  <option value="urgent">Urgent</option>
                  <option value="standard">Standard</option>
                </select>
              </label>
              <label className="field">
                <span>Tenant name(s)</span>
                <input
                  className="input"
                  name="tenant_names"
                  defaultValue={wo.tenant_names}
                  disabled={!isEditing}
                />
              </label>
              <label className="field">
                <span>Tenant phone</span>
                <input
                  className="input"
                  name="tenant_phone"
                  defaultValue={wo.tenant_phone ?? ""}
                  disabled={!isEditing}
                />
              </label>
            </div>

            <WorkOrderSummaryGrid timeline={scheduleSummary} timeOnSite={slaSummary} />

            <WorkOrderInfoPanel
              entireUnitInspected={wo.entire_unit_inspected}
              inspectionResults={wo.inspection_results}
              incompleteExplanation={wo.if_incomplete_explanation}
            />
          </form>

          {(wo.items || []).map((item) => (
            <WorkOrderItemSummary key={item.id} item={item} />
          ))}

          <div className="card stack">
            <h2>Signatures</h2>
            <SignaturesGrid>
              <SignatureDisplayCard
                label="Tenant"
                name={wo.tenant_signature_name}
                timestamp={wo.tenant_signature_at}
                signatureUrl={wo.tenant_signature_url}
              />
              <SignatureDisplayCard
                label="Technician"
                name={wo.tech_signature_name}
                timestamp={wo.tech_signature_at}
                signatureUrl={wo.tech_signature_url}
              />
            </SignaturesGrid>
          </div>

          <div className={`${styles.actions} no-print`}>
            {!isEditing ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditing(true)}
              >
                Edit work order
              </button>
            ) : null}
            <button
              type="button"
              className="btn"
              disabled={resend.isPending}
              onClick={() => resend.mutate()}
            >
              {resend.isPending ? "Resending…" : "Resend technician link"}
            </button>
            {wo.worker_share_url ? (
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  const link = frontendWorkerLink(wo.worker_share_url!);
                  try {
                    await shareOrCopy(link);
                    toast("Link ready");
                  } catch {
                    /* cancelled */
                  }
                }}
              >
                Share frontend link
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-danger"
              disabled={remove.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete work order?"
        message={
          wo
            ? `${wo.work_order_number} and its photos, signatures, and PDF will be permanently removed.`
            : ""
        }
        confirmLabel="Delete work order"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setBanner(null);
          remove.mutate(woId, { onSettled: () => setDeleteOpen(false) });
        }}
      />

      <BottomActionBar>
        <div className={styles.bottomActions}>
          {isEditing ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={patch.isPending}
                onClick={() => void handleSave()}
              >
                {patch.isPending ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="btn"
                disabled={patch.isPending}
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setIsEditing(true)}
              >
                Edit work order
              </button>
              <Link className="btn btn-primary" to="/dashboard">
                Back to dashboard
              </Link>
            </>
          )}
        </div>
      </BottomActionBar>
    </main>
  );
}
