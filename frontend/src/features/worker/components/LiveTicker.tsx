import { useEffect, useState } from "react";
import { elapsedMs, elapsedMinutes, formatElapsedMs } from "../../../lib/format";
import styles from "./LiveTicker.module.css";

interface LiveTickerProps {
  start: string | null;
  targetHours: number;
  /**
   * A performance.now() value captured after this browser successfully starts
   * the job. It prevents a device clock that is ahead of the API server from
   * making a brand-new timer appear to have already run for several minutes.
   */
  monotonicStart: number | null;
}

export function LiveTicker({ start, targetHours, monotonicStart }: LiveTickerProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!start) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [start]);

  if (!start) return null;

  // For a job started in this page session, performance.now() advances
  // monotonically and is not affected by an incorrect wall clock. For an
  // existing job (such as after a refresh), the server start timestamp remains
  // the durable source of truth.
  const elapsed = monotonicStart == null
    ? elapsedMs(start)
    : Math.max(0, performance.now() - monotonicStart);
  const mins = monotonicStart == null
    ? elapsedMinutes(start)
    : Math.floor(elapsed / 60000);
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
