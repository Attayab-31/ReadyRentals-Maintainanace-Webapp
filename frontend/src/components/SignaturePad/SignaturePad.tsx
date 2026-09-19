import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from "react";
import styles from "./SignaturePad.module.css";

type Props = {
  disabled?: boolean;
  onChange?: (empty: boolean) => void;
};

export type SignaturePadHandle = {
  toPng: () => string;
  clear: () => void;
  isEmpty: () => boolean;
};

export function SignaturePad({
  disabled,
  onChange,
  padRef,
}: Props & { padRef: MutableRefObject<SignaturePadHandle | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const empty = useRef(true);
  const [, bump] = useState(0);

  const resize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * ratio);
    canvas.height = Math.floor(h * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(16, h - 28);
    ctx.lineTo(w - 16, h - 28);
    ctx.strokeStyle = "rgba(22,34,43,0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    empty.current = true;
    onChange?.(true);
  };

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    padRef.current = {
      toPng: () => canvas?.toDataURL("image/png") ?? "",
      clear: () => resize(),
      isEmpty: () => empty.current,
    };
  });

  const pos = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#16222B";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    empty.current = false;
    onChange?.(false);
    bump((n) => n + 1);
  };

  const end = () => {
    drawing.current = false;
  };

  return (
    <div className={styles.wrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="Signature pad"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className={styles.actions}>
        <button type="button" className="btn" disabled={disabled} onClick={() => resize()}>
          Clear
        </button>
      </div>
    </div>
  );
}
