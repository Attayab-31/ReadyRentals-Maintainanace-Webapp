import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { startJob } from "../../../api/endpoints";
import type { WorkerWorkOrder } from "../../../api/types";
import { BottomActionBar } from "../../../components";
import { queryKeys } from "../../../lib/queryKeys";
import styles from "./AssignedStep.module.css";

interface AssignedStepProps {
  token: string;
  wo: WorkerWorkOrder;
  onError: (e: unknown) => void;
  onStarted: (workOrder: WorkerWorkOrder) => void;
}

export function AssignedStep({ token, wo, onError, onStarted }: AssignedStepProps) {
  const qc = useQueryClient();
  const storageKey = `wo:${token}:workerName`;
  const assignedName = wo.assigned_to_name || "Unassigned";
  const [name] = useState(assignedName);

  useEffect(() => {
    sessionStorage.setItem(storageKey, assignedName);
  }, [assignedName, storageKey]);

  const start = useMutation({
    mutationFn: () => startJob(token),
    onSuccess: async (startedWorkOrder) => {
      // Use the POST response immediately. Besides avoiding an unnecessary
      // flash of the assigned view, this lets the timer anchor at the moment
      // this browser receives confirmation that the job was started.
      qc.setQueryData(queryKeys.worker(token), startedWorkOrder);
      onStarted(startedWorkOrder);
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
          <li>Use No picture only for after photos that cannot be taken. New work items need a before photo before completion.</li>
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
