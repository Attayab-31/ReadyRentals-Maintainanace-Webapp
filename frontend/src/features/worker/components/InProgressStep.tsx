import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { completeJob, saveProgress } from "../../../api/endpoints";
import type { WorkerWorkOrder, WorkOrderItem } from "../../../api/types";
import { BottomActionBar } from "../../../components";
import { useToast } from "../../../hooks/useToast";
import { queryKeys } from "../../../lib/queryKeys";
import { WorkerItemCard } from "./WorkerItemCard";
import styles from "./InProgressStep.module.css";

interface InProgressStepProps {
  token: string;
  wo: WorkerWorkOrder;
  onError: (e: unknown) => void;
}

function slotReady(item: WorkOrderItem, slot: "before" | "after") {
  if (slot === "before") {
    return Boolean(item.before_photo_url) || (!item.before_photo_required && item.before_photo_skipped);
  }
  return Boolean(item.after_photo_url) || item.after_photo_skipped;
}

export function InProgressStep({ token, wo, onError }: InProgressStepProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [inspected, setInspected] = useState<boolean | null>(wo.entire_unit_inspected);
  const [results, setResults] = useState(wo.inspection_results || "");

  useEffect(() => {
    setInspected(wo.entire_unit_inspected);
    setResults(wo.inspection_results || "");
  }, [wo.entire_unit_inspected, wo.inspection_results]);

  const allResolved = (wo.items || []).length > 0 && (wo.items || []).every((item) => item.resolved);
  const beforePhotosReady = (wo.items || []).every((item) => slotReady(item, "before"));
  const afterPhotosReady = (wo.items || []).every((item) => slotReady(item, "after"));
  const photoReady = beforePhotosReady && afterPhotosReady;
  const inspectAnswered = inspected !== null;
  const inspectNotesReady = results.trim().length > 0;
  const canFinish = allResolved && photoReady && inspectAnswered && inspectNotesReady;

  const persist = useMutation({
    mutationFn: () =>
      saveProgress(token, {
        entire_unit_inspected: inspected,
        inspection_results: results || null,
      }),
    onSuccess: (updatedWorkOrder) => {
      qc.setQueryData(queryKeys.worker(token), updatedWorkOrder);
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
        <WorkerItemCard key={item.id} token={token} item={item} onError={onError} />
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

      {!beforePhotosReady ? (
        <div className={styles.photoRequired} role="status">
          <span className={styles.photoRequiredLabel}>Before photos</span>
          <p>Add a before photo for every task. Photos added by the office are already attached; otherwise capture one here.</p>
        </div>
      ) : null}

      {!afterPhotosReady ? (
        <div className={styles.photoRequired} role="status">
          <span className={styles.photoRequiredLabel}>After photos</span>
          <p>Add an after photo for each task, or select No picture if one cannot be captured.</p>
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
