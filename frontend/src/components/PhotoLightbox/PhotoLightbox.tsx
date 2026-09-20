import { useEffect } from "react";
import styles from "./PhotoLightbox.module.css";

export function PhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <div className={styles.frame} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close photo">
          Close
        </button>
        <img className={styles.img} src={src} alt={alt} />
      </div>
    </div>
  );
}
