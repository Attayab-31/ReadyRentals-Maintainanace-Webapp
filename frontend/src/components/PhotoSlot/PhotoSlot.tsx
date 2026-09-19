import styles from "./PhotoSlot.module.css";

type Props = {
  label: string;
  src?: string | null;
  acceptCapture?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  onFile?: (file: File) => void;
};

export function PhotoSlot({ label, src, acceptCapture = true, readOnly, disabled, onFile }: Props) {
  const filled = Boolean(src);
  return (
    <div className={`${styles.card} ${!filled ? styles.cardMissing : ""}`}>
      <div className={styles.header}>
        <span className={styles.lbl}>{label}</span>
        <span className={`${styles.badge} ${filled ? styles.badgeFilled : styles.badgeMissing}`}>
          {!filled ? <span className={styles.badgeIcon} aria-hidden="true">×</span> : null}
          {filled ? "Captured" : "Missing"}
        </span>
      </div>

      <div className={`${styles.slot} ${filled ? styles.filled : styles.empty}`}>
        {filled ? (
          <img className={styles.thumb} src={src ?? ""} alt={label} />
        ) : (
          <div className={styles.emptyState}>
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M9 6l1.2-2h3.6L15 6" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span>No photo captured</span>
          </div>
        )}

        {!readOnly && (
          <>
            <input
              className={styles.file}
              type="file"
              accept="image/*"
              capture={acceptCapture ? "environment" : undefined}
              disabled={disabled}
              aria-label={filled ? `Retake ${label}` : `Capture ${label}`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onFile?.(file);
              }}
            />
            {filled ? <span className={styles.retake}>Retake</span> : null}
          </>
        )}
      </div>
    </div>
  );
}
