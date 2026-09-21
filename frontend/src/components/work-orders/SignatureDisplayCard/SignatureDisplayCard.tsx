import { formatStamp } from "../../../lib/format";
import styles from "./SignatureDisplayCard.module.css";

interface SignatureDisplayCardProps {
  label: "Tenant" | "Technician" | string;
  name: string | null | undefined;
  timestamp: string | null | undefined;
  signatureUrl: string | null | undefined;
}

export function SignatureDisplayCard({
  label,
  name,
  timestamp,
  signatureUrl,
}: SignatureDisplayCardProps) {
  const hasSignature = Boolean(signatureUrl);
  const signerName = name || "Missing signature";
  const formattedTime = formatStamp(timestamp);

  return (
    <div
      className={`${styles.card} ${
        hasSignature ? styles.cardSigned : styles.cardMissing
      }`}
    >
      <div className={styles.header}>
        <div>
          <p className={styles.label}>{label}</p>
          <p className={styles.person}>{signerName}</p>
        </div>
        <div
          className={`${styles.stateBadge} ${
            hasSignature ? styles.signed : styles.missing
          }`}
        >
          {hasSignature ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.stateIcon}>
              <path
                d="M7 12.5 10.2 15.7 17 8.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.stateIcon}>
              <path
                d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          )}
          <span>{hasSignature ? "Signed" : "Missing"}</span>
        </div>
      </div>

      {hasSignature && signatureUrl ? (
        <div className={styles.preview}>
          <p className={styles.time}>{formattedTime}</p>
          <img className={styles.sig} src={signatureUrl} alt={`${label} signature`} />
        </div>
      ) : (
        <div className={styles.missingState}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.missingIcon}>
            <path
              d="M7 7.5h10M7 12h10M7 16.5h7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M5.5 4.5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
          <p>No signature captured</p>
        </div>
      )}
    </div>
  );
}

export function SignaturesGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
