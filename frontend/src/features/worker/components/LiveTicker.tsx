import { useEffect, useState } from "react";
import { elapsedMs, elapsedMinutes, formatElapsedMs } from "../../../lib/format";
import styles from "./LiveTicker.module.css";

interface LiveTickerProps {
  start: string | null;
  targetHours: number;
}

export function LiveTicker({ start, targetHours }: LiveTickerProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!start) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [start]);

  if (!start) return null;

  const elapsed = elapsedMs(start);
  const mins = elapsedMinutes(start);
  const over = mins > targetHours * 60;

  return (
    <div className={`card ${styles.ticker}`}>
      <span>Elapsed time: {formatElapsedMs(elapsed)}</span>
      <span className={over ? styles.over : undefined}>
        Target time: {targetHours}h {over ? "· over target" : ""}
      </span>
    </div>
  );
}
