import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  const [banner, setBanner] = useState<unknown>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const query = useWorkOrderDetailQuery(woId);

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
      ? `${wo.start_time ? formatStamp(wo.start_time) : "Not started"} → ${wo.end_time ? formatStamp(wo.end_time) : "Open"
      }`
      : "Not scheduled"
    : "Not scheduled";

  const slaSummary = wo
    ? wo.within_target == null
      ? wo.duration_minutes == null
        ? "Pending"
        : `${formatDuration(wo.duration_minutes)} • Pending`
      : `${wo.duration_minutes == null
        ? "No duration logged"
        : formatDuration(wo.duration_minutes)
      } • ${wo.within_target ? "Within target" : "Over target"}`
    : "Pending";

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
            </div>
            <div className={styles.badges}>
              <StatusBadge status={wo.status} />
              <PriorityBadge priority={wo.priority} />
            </div>
          </div>

          <section className="card stack" aria-label="Work order details">
            <div className={styles.fieldGrid}>
              <label className="field">
                <span>Technician name</span>
                <input
                  className="input"
                  name="assigned_to_name"
                  defaultValue={wo.assigned_to_name}
                  disabled
                />
              </label>
              <label className="field">
                <span>Technician phone</span>
                <input
                  className="input"
                  name="assigned_to_phone"
                  defaultValue={wo.assigned_to_phone}
                  disabled
                />
              </label>
              <label className="field">
                <span>Technician email</span>
                <input
                  className="input"
                  name="assigned_to_email"
                  type="email"
                  defaultValue={wo.assigned_to_email ?? ""}
                  disabled
                />
                {wo.assigned_to_email ? (
                  <small>
                    {wo.worker_email_notified_at
                      ? "Assignment link emailed"
                      : wo.worker_email_notify_error
                        ? `Email delivery failed: ${wo.worker_email_notify_error}`
                        : "Assignment email pending"}
                  </small>
                ) : null}
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
                  disabled
                />
              </label>
              <label className="field">
                <span>Property address</span>
                <input
                  className="input"
                  name="service_address"
                  defaultValue={wo.service_address}
                  disabled
                />
              </label>
              <label className="field">
                <span>Priority</span>
                <select
                  className="select"
                  name="priority"
                  defaultValue={wo.priority.code}
                  disabled
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
                  disabled
                />
              </label>
              <label className="field">
                <span>Tenant phone</span>
                <input
                  className="input"
                  name="tenant_phone"
                  defaultValue={wo.tenant_phone ?? ""}
                  disabled
                />
              </label>
            </div>

            <WorkOrderSummaryGrid timeline={scheduleSummary} timeOnSite={slaSummary} />

            <WorkOrderInfoPanel
              entireUnitInspected={wo.entire_unit_inspected}
              inspectionResults={wo.inspection_results}
              incompleteExplanation={wo.if_incomplete_explanation}
            />
          </section>

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
            <button
              type="button"
              className="btn"
              disabled={resend.isPending}
              onClick={() => resend.mutate()}
            >
              {resend.isPending ? "Sending…" : "Send link again"}
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
                Share link
              </button>
            ) : null}
            <button
              type="button"
              className="btn"
              disabled={remove.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              {remove.isPending ? "Moving…" : "Move to recycle bin"}
            </button>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title="Move work order to the recycle bin?"
        message={
          wo
            ? `${wo.work_order_number} and its attachments will be kept in the owner recycle bin until restored or permanently deleted.`
            : ""
        }
        confirmLabel="Move to recycle bin"
        busy={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setBanner(null);
          remove.mutate(woId, { onSettled: () => setDeleteOpen(false) });
        }}
      />

      <BottomActionBar>
        <div className={styles.bottomActions}>
          <Link className="btn btn-primary" to="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </BottomActionBar>
    </main>
  );
}
