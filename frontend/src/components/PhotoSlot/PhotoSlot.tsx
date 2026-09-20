import { useState, type ChangeEvent } from "react";
import { PhotoLightbox } from "../PhotoLightbox/PhotoLightbox";
import styles from "./PhotoSlot.module.css";

type Props = {
  label: string;
  src?: string | null;
  acceptCapture?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  skipped?: boolean;
  onFile?: (file: File) => void;
  onSkipChange?: (skipped: boolean) => void;
};

export function PhotoSlot({
  label,
  src,
  acceptCapture = true,
  readOnly,
  disabled,
  skipped = false,
  onFile,
  onSkipChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const filled = Boolean(src);
  const canSkip = Boolean(onSkipChange) && !readOnly;

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onFile?.(file);
  }

  const captureAttrs = {
    type: "file" as const,
    accept: "image/*",
    capture: acceptCapture ? ("environment" as const) : undefined,
    disabled,
    onChange: pickFile,
  };

  return (
    <div className={`${styles.card} ${!filled && !skipped ? styles.cardMissing : ""}`}>
      <div className={styles.header}>
        <span className={styles.lbl}>{label}</span>
        <span
          className={`${styles.badge} ${filled ? styles.badgeFilled : skipped ? styles.badgeSkip : styles.badgeMissing}`}
        >
          {filled ? "Captured" : skipped ? "No picture" : "Missing"}
        </span>
      </div>

      <div className={`${styles.slot} ${filled ? styles.filled : styles.empty}`}>
        {filled ? (
          <button type="button" className={styles.zoom} onClick={() => setOpen(true)} aria-label={`Enlarge ${label}`}>
            <img className={styles.thumb} src={src ?? ""} alt={label} />
          </button>
        ) : (
          <div className={styles.emptyState}>
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M9 6l1.2-2h3.6L15 6" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span>{skipped ? "No picture selected" : "No photo captured"}</span>
          </div>
        )}

        {!readOnly && !skipped && !filled ? (
          <input className={styles.file} aria-label={`Capture ${label}`} {...captureAttrs} />
        ) : null}

        {!readOnly && !skipped && filled ? (
          <label className={styles.retake}>
            Retake
            <input className={styles.hiddenFile} aria-label={`Retake ${label}`} {...captureAttrs} />
          </label>
        ) : null}
      </div>

      {canSkip ? (
        <label className={styles.skip}>
          <input
            type="checkbox"
            checked={skipped}
            disabled={disabled}
            onChange={(e) => onSkipChange?.(e.target.checked)}
          />
          <span>No picture</span>
        </label>
      ) : null}

      {open && src ? <PhotoLightbox src={src} alt={label} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
