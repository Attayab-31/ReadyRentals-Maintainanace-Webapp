import { useEffect, useRef, useState } from "react";
import { SignaturePad, type SignaturePadHandle } from "../../../components";

interface SignBlockProps {
  title: string;
  disabled?: boolean;
  defaultName: string;
  confirmText?: string;
  pending: boolean;
  onConfirm: (name: string, png: string) => void;
}

export function SignBlock({
  title,
  disabled,
  defaultName,
  confirmText,
  pending,
  onConfirm,
}: SignBlockProps) {
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
          <input
            type="checkbox"
            checked={agreed}
            disabled={disabled}
            onChange={(e) => setAgreed(e.target.checked)}
          />
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
