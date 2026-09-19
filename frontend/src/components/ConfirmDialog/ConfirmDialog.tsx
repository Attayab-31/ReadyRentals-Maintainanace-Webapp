import { useEffect } from "react";
import styles from "./ConfirmDialog.module.css";

type Props = {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel,
    danger,
    busy,
    onConfirm,
    onCancel,
}: Props) {
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !busy) onCancel();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [busy, onCancel, open]);

    if (!open) return null;

    return (
        <div className={styles.backdrop} role="presentation" onMouseDown={() => !busy && onCancel()}>
            <section
                className={styles.dialog}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <p className={styles.eyebrow}>Please confirm</p>
                <h2 id="confirm-dialog-title">{title}</h2>
                <p id="confirm-dialog-message" className={styles.message}>{message}</p>
                <div className={styles.actions}>
                    <button type="button" className="btn" disabled={busy} onClick={onCancel}>Cancel</button>
                    <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={onConfirm}>
                        {busy ? "Working..." : confirmLabel}
                    </button>
                </div>
            </section>
        </div>
    );
}
