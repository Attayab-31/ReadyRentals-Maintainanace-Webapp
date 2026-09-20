import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  completeJob,
  downloadWorkerPdf,
  patchWorkerItem,
  saveProgress,
  signJob,
  startJob,
  uploadItemPhoto,
} from "../api/endpoints";
import type { WorkerWorkOrder, WorkOrderItem } from "../api/types";
import { BottomActionBar } from "../components/BottomActionBar/BottomActionBar";
import { ErrorBanner } from "../components/ErrorBanner/ErrorBanner";
import { PhotoSlot } from "../components/PhotoSlot/PhotoSlot";
import { SignaturePad, type SignaturePadHandle } from "../components/SignaturePad/SignaturePad";
import { StatusBadge } from "../components/StatusBadge/StatusBadge";
import { Stepper } from "../components/Stepper/Stepper";
import { elapsedMs, elapsedMinutes, formatDuration, formatElapsedMs, formatStamp, hourTarget, stepperIndex } from "../lib/format";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../hooks/useToast";
import styles from "./WorkerFlow.module.css";

const TENANT_CONFIRM =
  "I confirm to be satisfied with the repairs and do not know of any outstanding hazardous conditions";

function Header({ wo }: { wo: WorkerWorkOrder }) {
  const targetHours = hourTarget(wo.priority);
  const priorityLabel = wo.priority?.name || "Standard";
  const tenantPhone = wo.tenant_phone?.trim();
  const phoneIsValid = Boolean(tenantPhone && tenantPhone !== wo.tenant_names?.trim());

  return (
    <header className={`card ${styles.header}`}>
      <div className={styles.metaRow}>
        <div>
          <p className={styles.kicker}>Property</p>
          <h1>{wo.service_address}</h1>
        </div>
        <StatusBadge status={wo.status} />
      </div>

      <div className={styles.infoGrid}>
        <div>
          <span className={styles.label}>Technician</span>
          <strong>{wo.assigned_to_name || "Unassigned"}</strong>
        </div>
        <div>
          <span className={styles.label}>Work order number</span>
          <strong className="mono">{wo.work_order_number}</strong>
        </div>
        <div>
          <span className={styles.label}>Target time</span>
          <strong>
            {priorityLabel} · {targetHours}h
          </strong>
        </div>
      </div>

      <div className={styles.infoGrid}>
        {wo.tenant_names ? (
          <>
            <div>
              <span className={styles.label}>Tenant name</span>
              <strong>{wo.tenant_names}</strong>
            </div>
            {phoneIsValid ? (
              <div>
                <span className={styles.label}>Tenant phone</span>
                <strong>{tenantPhone}</strong>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <Stepper current={stepperIndex(wo.status)} />
    </header>
  );
}

function Assigned({
  token,
  wo,
  onError,
}: {
  token: string;
  wo: WorkerWorkOrder;
  onError: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  const storageKey = `wo:${token}:workerName`;
  const assignedName = wo.assigned_to_name || "Unassigned";
  const [name] = useState(assignedName);
  useEffect(() => {
    sessionStorage.setItem(storageKey, assignedName);
  }, [assignedName, storageKey]);
  const start = useMutation({
    mutationFn: () => startJob(token),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.worker(token) });
    },
    onError,
  });

  return (
    <>
      <section className={`card ${styles.intro}`}>
        <h2>Before you start</h2>
        <p>Review the work below, confirm your name, and begin the job when you are ready to start onsite work.</p>
        <ul className={styles.infoList}>
          <li>When you press Start job, the job timer begins tracking elapsed time.</li>
          <li>Mark each task Resolved or Not resolved. If you cannot finish an item, write why in Notes and Save for later.</li>
          <li>Tap a photo to enlarge it. Use No picture if a photo cannot be taken.</li>
          <li>Signatures happen only after every task is Resolved.</li>
        </ul>
      </section>
      {(wo.items || []).map((item) => (
        <article className="card stack" key={item.id}>
          <p className={styles.taskLabel}>Job task</p>
          <h2>{item.category}</h2>
          <p>{item.details || "—"}</p>
        </article>
      ))}
      <BottomActionBar>
        <button
          type="button"
          className="btn btn-primary"
          disabled={start.isPending || !name.trim()}
          onClick={() => {
            onError(null);
            sessionStorage.setItem(storageKey, name.trim());
            start.mutate();
          }}
        >
          {start.isPending ? "Starting…" : "Start job"}
        </button>
      </BottomActionBar>
    </>
  );
}

function Ticker({ start, targetHours }: { start: string | null; targetHours: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!start) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [start]);

  if (!start) return null;

  const elapsed = elapsedMs(start);
  const mins = elapsedMinutes(start);
  const over = mins > targetHours * 60;
  return (
    <div className={`card ${styles.ticker}`}>
      <span>Elapsed time: {formatElapsedMs(elapsed)}</span>
      <span className={over ? styles.over : undefined}>
        Target time: {targetHours}h {over ? "· over target" : ""}
      </span>
    </div>
  );
}

function ItemCard({
  token,
  item,
  onError,
}: {
  token: string;
  item: WorkOrderItem;
  onError: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(item.tech_notes || "");
  const [preview, setPreview] = useState<{ before?: string; after?: string }>({});
  const patching = useMutation({
    mutationFn: (payload: {
      tech_notes?: string;
      resolved?: boolean;
      before_photo_skipped?: boolean;
      after_photo_skipped?: boolean;
    }) => patchWorkerItem(token, item.id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.worker(token) });
    },
    onError,
  });
  const photo = useMutation({
    mutationFn: ({ slot, file }: { slot: "before" | "after"; file: File }) =>
      uploadItemPhoto(token, item.id, slot, file),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.worker(token) });
    },
    onError,
  });

  useEffect(() => {
    setNotes(item.tech_notes || "");
  }, [item.tech_notes]);

  function onFile(slot: "before" | "after", file: File) {
    const url = URL.createObjectURL(file);
    setPreview((p) => ({ ...p, [slot]: url }));
    onError(null);
    photo.mutate(
      { slot, file },
      {
        onSettled: () => {
          URL.revokeObjectURL(url);
          setPreview((p) => ({ ...p, [slot]: undefined }));
        },
      },
    );
  }

  return (
    <article className={`${styles.itemCard} card stack`}>
      <div className={styles.itemHeader}>
        <h2>{item.category}</h2>
      </div>
      <div className={styles.resolveRow} role="group" aria-label="Task status">
        <button
          type="button"
          className={`${styles.choice} ${item.resolved ? styles.choiceOn : ""}`}
          disabled={patching.isPending}
          onClick={() => {
            onError(null);
            patching.mutate({ resolved: true });
          }}
        >
          Resolved
        </button>
        <button
          type="button"
          className={`${styles.choice} ${!item.resolved ? styles.choiceOff : ""}`}
          disabled={patching.isPending}
          onClick={() => {
            onError(null);
            patching.mutate({ resolved: false });
          }}
        >
          Not resolved
        </button>
      </div>
      <label className="field">
        <span>Details (office)</span>
        <textarea className="textarea" value={item.details || ""} readOnly disabled />
      </label>
      <label className="field">
        <span>Notes {item.resolved ? "" : "(say why you will return)"}</span>
        <textarea
          className="textarea"
          value={notes}
          placeholder={item.resolved ? "Optional notes from the technician" : "Why this is not resolved yet"}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (item.tech_notes || "")) {
              onError(null);
              patching.mutate({ tech_notes: notes });
            }
          }}
        />
      </label>
      <div className={styles.taskPhotos}>
        <PhotoSlot
          label="Before"
          src={preview.before || item.before_photo_url}
          skipped={item.before_photo_skipped}
          disabled={photo.isPending || patching.isPending}
          onFile={(file) => onFile("before", file)}
          onSkipChange={(skipped) => {
            onError(null);
            patching.mutate({ before_photo_skipped: skipped });
          }}
        />
        <PhotoSlot
          label="After"
          src={preview.after || item.after_photo_url}
          skipped={item.after_photo_skipped}
          disabled={photo.isPending || patching.isPending}
          onFile={(file) => onFile("after", file)}
          onSkipChange={(skipped) => {
            onError(null);
            patching.mutate({ after_photo_skipped: skipped });
          }}
        />
      </div>
    </article>
  );
}

function slotReady(item: WorkOrderItem, slot: "before" | "after") {
  if (slot === "before") return Boolean(item.before_photo_url) || item.before_photo_skipped;
  return Boolean(item.after_photo_url) || item.after_photo_skipped;
}

function InProgress({
  token,
  wo,
  onError,
}: {
  token: string;
  wo: WorkerWorkOrder;
  onError: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [inspected, setInspected] = useState<boolean | null>(wo.entire_unit_inspected);
  const [results, setResults] = useState(wo.inspection_results || "");
  useEffect(() => {
    setInspected(wo.entire_unit_inspected);
    setResults(wo.inspection_results || "");
  }, [wo.entire_unit_inspected, wo.inspection_results]);
  const allResolved = (wo.items || []).length > 0 && (wo.items || []).every((item) => item.resolved);
  const photoReady = (wo.items || []).every((item) => slotReady(item, "before") && slotReady(item, "after"));
  const inspectAnswered = inspected !== null;
  const inspectNotesReady = results.trim().length > 0;
  const canFinish = allResolved && photoReady && inspectAnswered && inspectNotesReady;

  const persist = useMutation({
    mutationFn: () =>
      saveProgress(token, {
        entire_unit_inspected: inspected,
        inspection_results: results || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.worker(token) });
      toast("Progress saved. The office can see this while the job stays In progress.");
    },
    onError,
  });
  const complete = useMutation({
    mutationFn: () =>
      completeJob(token, {
        entire_unit_inspected: Boolean(inspected),
        inspection_results: results.trim(),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.worker(token) });
    },
    onError,
  });

  return (
    <>
      {(wo.items || []).map((item) => (
        <ItemCard key={item.id} token={token} item={item} onError={onError} />
      ))}
      <div className="card stack">
        <p className={styles.question}>Did you inspect the entire property?</p>
        <div className={styles.resolveRow} role="group" aria-label="Entire property inspected">
          <button
            type="button"
            className={`${styles.choice} ${inspected === true ? styles.choiceOn : ""}`}
            onClick={() => setInspected(true)}
          >
            Yes
          </button>
          <button
            type="button"
            className={`${styles.choice} ${inspected === false ? styles.choiceOff : ""}`}
            onClick={() => setInspected(false)}
          >
            No
          </button>
        </div>
        {inspectAnswered ? (
          <label className="field">
            <span>Inspection results</span>
            <textarea
              className="textarea"
              value={results}
              onChange={(e) => setResults(e.target.value)}
              placeholder="Write what you found during the inspection."
            />
          </label>
        ) : null}
      </div>
      {!allResolved ? (
        <div className={styles.photoRequired} role="status">
          <span className={styles.photoRequiredLabel}>Signatures</span>
          <p>Mark every task Resolved to finish and collect signatures. Use Save for later if you need to return.</p>
        </div>
      ) : null}
      {!photoReady ? (
        <div className={styles.photoRequired} role="status">
          <span className={styles.photoRequiredLabel}>Photos</span>
          <p>Add a before and after photo for each task, or select No picture.</p>
        </div>
      ) : null}
      <BottomActionBar>
        <div className={styles.dualActions}>
          <button
            type="button"
            className="btn"
            disabled={persist.isPending || complete.isPending}
            onClick={() => {
              onError(null);
              persist.mutate();
            }}
          >
            {persist.isPending ? "Saving…" : "Save for later"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={complete.isPending || persist.isPending || !canFinish}
            onClick={() => {
              onError(null);
              complete.mutate();
            }}
          >
            {complete.isPending ? "Finishing job…" : "Finish job"}
          </button>
        </div>
      </BottomActionBar>
    </>
  );
}

function SignBlock({
  title,
  disabled,
  defaultName,
  confirmText,
  pending,
  onConfirm,
}: {
  title: string;
  disabled?: boolean;
  defaultName: string;
  confirmText?: string;
  pending: boolean;
  onConfirm: (name: string, png: string) => void;
}) {
  const padRef = useRef<SignaturePadHandle | null>(null);
  const [name, setName] = useState(defaultName);
  const [agreed, setAgreed] = useState(!confirmText);
  const [empty, setEmpty] = useState(true);
  const padOn = !disabled && agreed;

  useEffect(() => {
    setName(defaultName);
    setAgreed(!confirmText);
  }, [defaultName, confirmText]);

  return (
    <section className="card stack">
      <h2>{title}</h2>
      <label className="field">
        <span>Name</span>
        <input className="input" value={name} disabled readOnly aria-readonly="true" />
      </label>
      {confirmText ? (
        <label className="check">
          <input type="checkbox" checked={agreed} disabled={disabled} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{confirmText}</span>
        </label>
      ) : null}
      <SignaturePad padRef={padRef} disabled={!padOn} onChange={setEmpty} />
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled || pending || !name.trim() || !agreed || empty}
        onClick={() => {
          if (padRef.current?.isEmpty()) return;
          onConfirm(name.trim(), padRef.current?.toPng() || "");
        }}
      >
        {pending ? "Saving signature…" : "Save signature"}
      </button>
    </section>
  );
}

function Signoff({
  token,
  wo,
  onError,
}: {
  token: string;
  wo: WorkerWorkOrder;
  onError: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  const tenantDone = wo.tenant_signed || Boolean(wo.tenant_signature_url);
  const sign = useMutation({
    mutationFn: (payload: { signer: "tenant" | "tech"; name: string; signature_png_base64: string }) =>
      signJob(token, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.worker(token) });
    },
    onError,
  });
  const workerName = wo.assigned_to_name || sessionStorage.getItem(`wo:${token}:workerName`) || "Unassigned";

  return (
    <>
      {!tenantDone ? (
        <SignBlock
          key="tenant-sign"
          title="Tenant signature"
          defaultName={wo.tenant_names}
          confirmText={TENANT_CONFIRM}
          pending={sign.isPending && sign.variables?.signer === "tenant"}
          onConfirm={(name, png) => {
            onError(null);
            sign.mutate({ signer: "tenant", name, signature_png_base64: png });
          }}
        />
      ) : (
        <SignBlock
          key="tech-sign"
          title="Technician signature"
          defaultName={workerName}
          disabled={wo.tech_signed}
          pending={sign.isPending && sign.variables?.signer === "tech"}
          onConfirm={(name, png) => {
            onError(null);
            sign.mutate({ signer: "tech", name, signature_png_base64: png });
          }}
        />
      )}
      <BottomActionBar>
        <button type="button" className="btn btn-primary" disabled>
          {wo.status === "signed_off"
            ? "Signed"
            : tenantDone
              ? "Awaiting tech signature"
              : "Awaiting tenant signature"}
        </button>
      </BottomActionBar>
    </>
  );
}

function Record({ token, wo, onError }: { token: string; wo: WorkerWorkOrder; onError: (e: unknown) => void }) {
  const pdf = useMutation({
    mutationFn: () => downloadWorkerPdf(token),
    onError,
  });
  return (
    <>
      <div className="card stack">
        <h2>Completion summary</h2>
        <p className="mono">
          Started {formatStamp(wo.start_time)} · Finished {formatStamp(wo.end_time)}
        </p>
        <p>
          Time on site: <span className="mono">{formatDuration(wo.duration_minutes)}</span>
        </p>
        <p>
          Target result: <span className="mono">
            {wo.within_target == null ? "Pending" : wo.within_target ? "On time" : "Over target"}
          </span>
        </p>
      </div>
      {(wo.items || []).map((item) => (
        <article className="card stack" key={item.id}>
          <h2>{item.category}</h2>
          <p><strong>Details:</strong> {item.details || "—"}</p>
          {item.tech_notes ? <p><strong>Notes:</strong> {item.tech_notes}</p> : null}
          <p>{item.resolved ? "Resolved" : "Not resolved"}</p>
          <div className={styles.photos}>
            <PhotoSlot
              label="Before"
              src={item.before_photo_url}
              skipped={item.before_photo_skipped}
              readOnly
            />
            <PhotoSlot
              label="After"
              src={item.after_photo_url}
              skipped={item.after_photo_skipped}
              readOnly
            />
          </div>
        </article>
      ))}
      <div className="card stack">
        <h2>Signatures</h2>
        <p>
          <strong>Tenant signature</strong><br />
          {wo.tenant_signature_name} · {formatStamp(wo.tenant_signature_at)}
        </p>
        {wo.tenant_signature_url ? <img className={styles.sigImg} src={wo.tenant_signature_url} alt="Tenant signature" /> : null}
        <p>
          <strong>Technician signature</strong><br />
          {wo.tech_signature_name} · {formatStamp(wo.tech_signature_at)}
        </p>
        {wo.tech_signature_url ? <img className={styles.sigImg} src={wo.tech_signature_url} alt="Tech signature" /> : null}
      </div>
      <BottomActionBar>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pdf.isPending}
          onClick={() => {
            onError(null);
            pdf.mutate();
          }}
        >
          {pdf.isPending ? "Downloading…" : "Download PDF"}
        </button>
      </BottomActionBar>
    </>
  );
}

export function WorkerFlow({ token, wo }: { token: string; wo: WorkerWorkOrder }) {
  const [error, setError] = useState<unknown>(null);
  const hasStarted = Boolean(wo.start_time);

  return (
    <main className="page stack">
      <Header wo={wo} />
      <ErrorBanner error={error} />
      {wo.status === "in_progress" && hasStarted ? <Ticker start={wo.start_time} targetHours={hourTarget(wo.priority)} /> : null}
      {wo.status === "assigned" ? <Assigned token={token} wo={wo} onError={setError} /> : null}
      {wo.status === "in_progress" ? <InProgress token={token} wo={wo} onError={setError} /> : null}
      {wo.status === "completed_pending_signoff" ? (
        <Signoff token={token} wo={wo} onError={setError} />
      ) : null}
      {wo.status === "signed_off" ? <Record token={token} wo={wo} onError={setError} /> : null}
    </main>
  );
}
