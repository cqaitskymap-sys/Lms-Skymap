import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CALENDAR_DAY =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(?:00|12):00:00(?:\.\d+)?Z)?$/;

function calendarParts(dateStr: string): { y: number; m: number; d: number } | null {
  const match = CALENDAR_DAY.exec(dateStr.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

/** yyyy-MM-dd in the viewer's local calendar, for `<input type="date">`. */
export function localDateInputValue(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calendar day for a stored value.
 * Noon/midnight UTC dates keep their written day. Real timestamps use the local day,
 * so an evening UTC instant does not land on the previous date in India.
 */
export function calendarDayKey(value: string | Date | undefined | null): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return localDateInputValue(value);
  }
  const trimmed = value.trim();
  const parts = calendarParts(trimmed);
  if (parts) {
    return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return localDateInputValue(parsed);
}

export function localDayBound(dateStr: string, endOfDay: boolean): number {
  const parts = calendarParts(dateStr);
  if (parts) {
    return endOfDay
      ? new Date(parts.y, parts.m - 1, parts.d, 23, 59, 59, 999).getTime()
      : new Date(parts.y, parts.m - 1, parts.d, 0, 0, 0, 0).getTime();
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return Number.NaN;
  if (endOfDay) parsed.setHours(23, 59, 59, 999);
  else parsed.setHours(0, 0, 0, 0);
  return parsed.getTime();
}

export function isoInLocalDateRange(iso: string | undefined, dateFrom?: string, dateTo?: string): boolean {
  if (!iso) return true;
  if (!dateFrom && !dateTo) return true;
  const t = new Date(iso).getTime();
  if (dateFrom && t < localDayBound(dateFrom, false)) return false;
  if (dateTo && t > localDayBound(dateTo, true)) return false;
  return true;
}

/** Day before the 3-year anniversary. "2026-09-26" → "2029-09-25". */
export function reviewDateFromEffective(effective: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(effective.trim());
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return "";
  date.setFullYear(date.getFullYear() + 3);
  date.setDate(date.getDate() - 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Store a date-only value at noon UTC so the calendar day does not shift by timezone.
 * Full timestamps are left unchanged — rewriting them from the UTC date prefix
 * moves the day for instants that fall on the next local calendar day.
 */
export function calendarDateToIso(dateStr: string): string {
  const trimmed = dateStr.trim();
  const parts = calendarParts(trimmed);
  if (parts) {
    const mm = String(parts.m).padStart(2, "0");
    const dd = String(parts.d).padStart(2, "0");
    return `${parts.y}-${mm}-${dd}T12:00:00.000Z`;
  }
  if (CALENDAR_DAY.test(trimmed)) {
    throw new Error("Invalid date");
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }
  return parsed.toISOString();
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(?:00|12):00:00(?:\.\d+)?Z)?$/;

export function formatDate(date: string | Date | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return "—";
  if (typeof date === "string") {
    const match = CALENDAR_DATE.exec(date.trim());
    if (match) {
      const stable = new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
      );
      return stable.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...opts,
        timeZone: "UTC",
      });
    }
  }
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", opts ?? { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: string | Date | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateId(prefix?: string) {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return prefix ? `${prefix}_${id}` : id;
}

export function generateCertificateNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 900000) + 100000;
  return `CERT-${year}-${seq}`.toUpperCase();
}

/** Sequential org code: EMP000001, EMP000002, … */
export function formatEmployeeCode(seq: number) {
  return `EMP${String(seq).padStart(6, "0")}`;
}

/** @deprecated Prefer formatEmployeeCode for org-wide sequential IDs */
export function generateEmployeeCode(deptCode: string, seq: number) {
  return `EMP-${deptCode.toUpperCase()}-${String(seq).padStart(4, "0")}`;
}

export function generateSopNumber(deptCode: string, seq: number) {
  return `SOP-${deptCode.toUpperCase()}-${String(seq).padStart(3, "0")}`;
}

export function calculatePercentage(score: number, total: number) {
  if (total === 0) return 0;
  return Math.round((score / total) * 10000) / 100;
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}…`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function statusColor(status: string): string {
  const neutral = "status-chip-neutral";
  const success = "status-chip-success";
  const warning = "status-chip-warning";
  const danger = "status-chip-danger";
  const info = "status-chip-info";
  const progress = "status-chip-progress";
  const violet = "status-chip-violet";
  const map: Record<string, string> = {
    draft: neutral,
    created: neutral,
    inactive: neutral,
    cancelled: neutral,
    not_applicable: neutral,
    not_started: neutral,
    not_set: neutral,
    not_assigned: neutral,
    upcoming: neutral,
    active: success,
    approved: success,
    passed: success,
    completed: success,
    qualified: success,
    certified: success,
    failed: danger,
    obsolete: danger,
    expired: danger,
    overdue: danger,
    rejected: danger,
    terminated: danger,
    blocked: danger,
    not_competent: danger,
    superseded: warning,
    pending: warning,
    pending_verification: warning,
    hr_verification: warning,
    under_review: warning,
    verification_pending: warning,
    verified: info,
    induction: info,
    induction_assigned: info,
    in_progress: progress,
    assigned: progress,
    training: progress,
    exam: progress,
    scheduled: progress,
    rescheduled: progress,
    selected: info,
    induction_complete: success,
    induction_completed: success,
    trainer_completed: success,
    employee_acknowledged: info,
    handed_over: violet,
    department_handover: violet,
    qa_pending: violet,
    jd_created: info,
    tni_created: info,
    trainer_assigned: progress,
    sop_assigned: progress,
    retraining: warning,
    retraining_required: warning,
    assessment_pending: warning,
    deferred: warning,
    submitted: info,
    identified: info,
    prepared: info,
    planned: info,
    checked: progress,
    current: progress,
    training_scheduled: progress,
    training_completed: success,
    competent: success,
  };
  return map[status] ?? neutral;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
