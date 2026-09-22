import { HOUR_TARGETS, type Priority, type PriorityInfo, type WorkOrderStatus } from "../api/types";

export function hourTarget(priority: PriorityInfo | Priority | null | undefined): number {
  if (!priority) return HOUR_TARGETS.standard;
  if (typeof priority === "string") return HOUR_TARGETS[priority];
  return priority.hour_target ?? HOUR_TARGETS[priority.code] ?? HOUR_TARGETS.standard;
}

export function priorityCode(priority: PriorityInfo | Priority | null | undefined): Priority {
  if (!priority) return "standard";
  if (typeof priority === "string") return priority;
  return priority.code;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function normalizeIsoForDate(iso: string): string {
  const trimmed = iso.trim();
  if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}Z`;
}

export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(normalizeIsoForDate(iso));
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(normalizeIsoForDate(iso));
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(normalizeIsoForDate(iso));
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 45) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDateOnly(iso);
}

export function stepperIndex(status: WorkOrderStatus): number {
  switch (status) {
    case "assigned":
      return 0;
    case "in_progress":
      return 1;
    case "completed_pending_signoff":
      return 2;
    case "signed_off":
      return 3;
  }
}

export function elapsedMinutes(startIso: string | null | undefined): number {
  if (!startIso) return 0;
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 60000));
}

export function elapsedMs(startIso: string | null | undefined): number {
  if (!startIso) return 0;
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Date.now() - start);
}

export function formatElapsedMs(ms: number | null | undefined): string {
  const totalMs = Math.max(0, Math.floor(ms ?? 0));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(milliseconds).padStart(3, "0")}`;
}
