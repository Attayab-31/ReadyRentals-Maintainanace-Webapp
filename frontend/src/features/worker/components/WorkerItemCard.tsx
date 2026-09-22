import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { patchWorkerItem, uploadItemPhoto } from "../../../api/endpoints";
import type { WorkerWorkOrder, WorkOrderItem } from "../../../api/types";
import { PhotoSlot } from "../../../components";
import { queryKeys } from "../../../lib/queryKeys";
import styles from "./WorkerItemCard.module.css";

interface WorkerItemCardProps {
  token: string;
  item: WorkOrderItem;
  onError: (e: unknown) => void;
}

export function WorkerItemCard({ token, item, onError }: WorkerItemCardProps) {
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
    onMutate: async (payload) => {
      const queryKey = queryKeys.worker(token);
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<WorkerWorkOrder>(queryKey);
      qc.setQueryData<WorkerWorkOrder>(queryKey, (current) =>
        current
          ? {
              ...current,
              items: current.items.map((currentItem) =>
                currentItem.id === item.id ? { ...currentItem, ...payload } : currentItem,
              ),
            }
          : current,
      );
      return { previous };
    },
    onSuccess: (updatedItem) => {
      qc.setQueryData<WorkerWorkOrder>(queryKeys.worker(token), (current) =>
        current
          ? {
              ...current,
              items: current.items.map((currentItem) =>
                currentItem.id === updatedItem.id ? { ...currentItem, ...updatedItem } : currentItem,
              ),
            }
          : current,
      );
    },
    onError: (error, _payload, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.worker(token), context.previous);
      }
      onError(error);
    },
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
