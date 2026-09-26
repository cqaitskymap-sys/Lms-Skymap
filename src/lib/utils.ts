import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function localDayBound(dateStr: string, endOfDay: boolean): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return endOfDay
      ? new Date(y, mo, d, 23, 59, 59, 999).getTime()
      : new Date(y, mo, d, 0, 0, 0, 0).getTime();
  }
  const parsed = new Date(dateStr);
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

export function formatDate(date: string | Date | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", opts ?? { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: string | Date | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
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
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    passed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    obsolete: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    superseded: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    pending_verification: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    verified: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    qualified: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    induction_complete: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    assigned: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    scheduled: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    retraining: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    induction: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    handed_over: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    expired: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    selected: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    trainer_completed: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    employee_acknowledged: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    verification_pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    qa_pending: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    retraining_required: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    rescheduled: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    overdue: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    not_applicable: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  };
  return map[status] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
