import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteWorkOrder,
  getWorkOrder,
  patchWorkOrder,
  resendWorkOrder,
} from "../api/endpoints";
import type { Priority } from "../api/types";
import { BottomActionBar } from "../components/BottomActionBar/BottomActionBar";
import { ConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { ErrorBanner } from "../components/ErrorBanner/ErrorBanner";
import { PhotoSlot } from "../components/PhotoSlot/PhotoSlot";
import { PriorityBadge } from "../components/PriorityBadge/PriorityBadge";
import { StatusBadge } from "../components/StatusBadge/StatusBadge";
import { useToast } from "../hooks/useToast";
import { formatDuration, formatStamp } from "../lib/format";
import { queryKeys } from "../lib/queryKeys";
import { shareOrCopy, frontendWorkerLink } from "../lib/share";
import styles from "./WorkOrderDetailPage.module.css";

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const woId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<unknown>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.workOrder(woId),
    queryFn: () => getWorkOrder(woId),
    enabled: Number.isFinite(woId),
  });

  const patch = useMutation({
    mutationFn: (payload: Parameters<typeof patchWorkOrder>[1]) => patchWorkOrder(woId, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.workOrder(woId) });
      await qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast("Saved");
    },
    onError: setBanner,
  });

  const resend = useMutation({
    mutationFn: () => resendWorkOrder(woId),
    onSuccess: async (msg) => {
      await qc.invalidateQueries({ queryKey: queryKeys.workOrder(woId) });
      toast(msg.detail);
    },
    onError: setBanner,
  });

  const remove = useMutation({
    mutationFn: () => deleteWorkOrder(woId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["work-orders"] });
      navigate("/dashboard");
    },
    onError: setBanner,
  });

  const wo = query.data;
  const canEdit = false;
  const scheduleSummary = wo
    ? wo.start_time || wo.end_time
      ? `${wo.start_time ? formatStamp(wo.start_time) : "Not started"} → ${wo.end_time ? formatStamp(wo.end_time) : "Open"}`
      : "Not scheduled"
    : "Not scheduled";
  const slaSummary = wo
    ? wo.within_target == null
      ? wo.duration_minutes == null
        ? "Pending"
        : `${formatDuration(wo.duration_minutes)} • Pending`
      : `${wo.duration_minutes == null ? "No duration logged" : formatDuration(wo.duration_minutes)} • ${wo.within_target ? "Within target" : "Over target"}`
    : "Pending";

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!wo || !canEdit) return;
    const form = document.getElementById("wo-edit") as HTMLFormElement;
    const fd = new FormData(form);
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

  return (
    <main className="page stack">
      <ErrorBanner error={query.error} />
      <ErrorBanner error={banner} />
      {wo ? (
        <>
          <div className={styles.headerRow}>
            <h1 className="mono">{wo.work_order_number}</h1>
            <div className={styles.badges}>
              <StatusBadge status={wo.status} />
              <PriorityBadge priority={wo.priority} />
            </div>
          </div>
          <form id="wo-edit" className="card stack" onSubmit={save}>
            <div className={styles.fieldGrid}>
              <label className="field">
                <span>Technician name</span>
                <input className="input" name="assigned_to_name" defaultValue={wo.assigned_to_name} disabled={!canEdit} />
              </label>
              <label className="field">
                <span>Technician phone</span>
                <input className="input" name="assigned_to_phone" defaultValue={wo.assigned_to_phone} disabled={!canEdit} />
              </label>
              <label className="field">
                <span>Assigned date</span>
                <input className="input" type="date" name="date_assigned" defaultValue={wo.date_assigned} disabled={!canEdit} />
              </label>
              <label className="field">
                <span>Property address</span>
                <input className="input" name="service_address" defaultValue={wo.service_address} disabled={!canEdit} />
              </label>
              <label className="field">
                <span>Priority</span>
                <select className="select" name="priority" defaultValue={wo.priority.code} disabled={!canEdit}>
                  <option value="emergency">Emergency</option>
                  <option value="urgent">Urgent</option>
                  <option value="standard">Standard</option>
                </select>
              </label>
              <label className="field">
                <span>Tenant name(s)</span>
                <input className="input" name="tenant_names" defaultValue={wo.tenant_names} disabled={!canEdit} />
              </label>
              <label className="field">
                <span>Tenant phone</span>
                <input className="input" name="tenant_phone" defaultValue={wo.tenant_phone ?? ""} disabled={!canEdit} />
              </label>
            </div>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Work timeline</span>
                <p className={styles.summaryValue}>{scheduleSummary}</p>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Time on site</span>
                <p className={styles.summaryValue}>{slaSummary}</p>
              </div>
            </div>
            {(wo.if_incomplete_explanation || wo.inspection_results) ? (
              <div className={styles.infoPanel}>
                {wo.if_incomplete_explanation ? (
                  <p>
                    <strong>Follow-up note:</strong> {wo.if_incomplete_explanation}
                  </p>
                ) : null}
                {wo.inspection_results ? <p><strong>Inspection:</strong> {wo.inspection_results}</p> : null}
              </div>
            ) : null}
          </form>
          {(wo.items || []).map((item) => (
            <article className="card stack" key={item.id}>
              <h2>{item.category}</h2>
              <p>{item.details || "—"}</p>
              <div className={styles.photos}>
                <PhotoSlot label="Before" src={item.before_photo_url} readOnly />
                <PhotoSlot label="After" src={item.after_photo_url} readOnly />
              </div>
            </article>
          ))}
          <div className="card stack">
            <h2>Signatures</h2>
            <div className={styles.signatureGrid}>
              {[
                {
                  label: "Tenant",
                  signer: wo.tenant_signature_name || "Missing signature",
                  time: formatStamp(wo.tenant_signature_at),
                  src: wo.tenant_signature_url,
                },
                {
                  label: "Technician",
                  signer: wo.tech_signature_name || "Missing signature",
                  time: formatStamp(wo.tech_signature_at),
                  src: wo.tech_signature_url,
                },
              ].map(({ label, signer, time, src }) => {
                const hasSignature = Boolean(src);
                return (
                  <div
                    key={label}
                    className={`${styles.signatureCard} ${hasSignature ? styles.signatureCardSigned : styles.signatureCardMissing}`}
                  >
                    <div className={styles.signatureHeader}>
                      <div>
                        <p className={styles.signatureLabel}>{label}</p>
                        <p className={styles.signaturePerson}>{signer}</p>
                      </div>
                      <div className={`${styles.signatureState} ${hasSignature ? styles.signed : styles.missing}`}>
                        {hasSignature ? (
                          <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.stateIcon}>
                            <path d="M7 12.5 10.2 15.7 17 8.9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.stateIcon}>
                            <path d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        )}
                        <span>{hasSignature ? "Signed" : "Missing"}</span>
                      </div>
                    </div>
                    {hasSignature && src ? (
                      <div className={styles.signaturePreview}>
                        <p className={styles.signatureTime}>{time}</p>
                        <img className={styles.sig} src={src} alt={`${label} signature`} />
                      </div>
                    ) : (
                      <div className={styles.missingState}>
                        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.missingIcon}>
                          <path d="M7 7.5h10M7 12h10M7 16.5h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M5.5 4.5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                        <p>No signature captured</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className={`${styles.actions} no-print`}>
            <button type="button" className="btn" disabled={resend.isPending} onClick={() => resend.mutate()}>
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
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </>
      ) : query.isLoading ? (
        <p>Loading record…</p>
      ) : null}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete work order?"
        message={wo ? `${wo.work_order_number} and its photos, signatures, and PDF will be permanently removed.` : ""}
        confirmLabel="Delete work order"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setBanner(null);
          remove.mutate(undefined, { onSuccess: () => setDeleteOpen(false) });
        }}
      />
      <BottomActionBar>
        {canEdit ? (
          <button type="button" className="btn btn-primary" disabled={patch.isPending} onClick={() => void save()}>
            {patch.isPending ? "Saving…" : "Save changes"}
          </button>
        ) : (
          <Link className="btn btn-primary" to="/dashboard">
            Back to dashboard
          </Link>
        )}
      </BottomActionBar>
    </main>
  );
}
