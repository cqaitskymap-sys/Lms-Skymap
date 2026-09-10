import type {
  OjtApprovalConfig,
  OjtEvaluationCriterion,
  OjtMatrixCellValue,
  OjtPlannerMark,
  OjtSettings,
  OjtStatus,
} from "@/types/ojt";
import { CALENDAR_MONTHS } from "@/types/ojt";

export { CALENDAR_MONTHS };

export const OJT_ACK_STATEMENT =
  "I confirm that I have received On Job Training on the current applicable procedure, understood the practical activity demonstrated, and am able to perform the activity as trained.";

export const DEFAULT_OJT_APPROVAL_CONFIG: OjtApprovalConfig = {
  requireEmployeeAck: true,
  requireTrainerSignoff: true,
  requireHodVerification: true,
  requireQaApproval: true,
};

export const DEFAULT_OJT_SETTINGS: Omit<OjtSettings, "createdAt" | "updatedAt" | "createdBy"> = {
  id: "global",
  ...DEFAULT_OJT_APPROVAL_CONFIG,
  overdueGraceDays: 0,
};

export const TERMINAL_OJT_STATUSES: readonly OjtStatus[] = [
  "completed",
  "cancelled",
];

export const OPEN_OJT_STATUSES: readonly OjtStatus[] = [
  "draft",
  "selected",
  "assigned",
  "scheduled",
  "in_progress",
  "trainer_completed",
  "employee_acknowledged",
  "verification_pending",
  "qa_pending",
  "failed",
  "retraining_required",
  "rescheduled",
];

export const OJT_STATUS_LABELS: Record<OjtStatus, string> = {
  draft: "Draft",
  selected: "Selected",
  assigned: "Assigned",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  trainer_completed: "Trainer Completed",
  employee_acknowledged: "Employee Acknowledged",
  verification_pending: "HOD Verification Pending",
  qa_pending: "QA Approval Pending",
  completed: "Completed",
  failed: "Failed",
  retraining_required: "Retraining Required",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
};

export const OJT_MATRIX_LABELS: Record<OjtMatrixCellValue, string> = {
  not_set: "—",
  not_applicable: "NA",
  selected: "✓",
  pending: "Pending",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",
  retraining_required: "Retrain",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const DEFAULT_EVALUATION_CRITERIA: Omit<
  OjtEvaluationCriterion,
  "createdAt" | "updatedAt" | "createdBy"
>[] = [
  {
    id: "ojt_crit_understanding",
    label: "Understanding of procedure",
    description: "Employee can explain the purpose and steps of the procedure",
    order: 1,
    ratingScale: "1-5",
    isActive: true,
    isRequired: true,
  },
  {
    id: "ojt_crit_demonstration",
    label: "Demonstration of activity",
    description: "Employee can demonstrate the practical activity",
    order: 2,
    ratingScale: "1-5",
    isActive: true,
    isRequired: true,
  },
  {
    id: "ojt_crit_sop_adherence",
    label: "SOP adherence",
    description: "Work performed as per current SOP / reference document",
    order: 3,
    ratingScale: "pass_fail",
    isActive: true,
    isRequired: true,
  },
  {
    id: "ojt_crit_practical",
    label: "Practical competency",
    description: "Skill and accuracy during the practical task",
    order: 4,
    ratingScale: "1-5",
    isActive: true,
    isRequired: true,
  },
  {
    id: "ojt_crit_documentation",
    label: "Documentation practice",
    description: "Records completed contemporaneously and correctly",
    order: 5,
    ratingScale: "pass_fail",
    isActive: true,
    isRequired: true,
  },
  {
    id: "ojt_crit_gmp",
    label: "Safety / GMP compliance",
    description: "Gowning, hygiene, safety and GMP behaviour during OJT",
    order: 6,
    ratingScale: "pass_fail",
    isActive: true,
    isRequired: true,
  },
  {
    id: "ojt_crit_independent",
    label: "Ability to perform independently",
    description: "Can perform the activity without prompting",
    order: 7,
    ratingScale: "1-5",
    isActive: true,
    isRequired: true,
  },
  {
    id: "ojt_crit_observation",
    label: "Trainer observation",
    description: "Overall trainer observation of practical performance",
    order: 8,
    ratingScale: "1-5",
    isActive: true,
    isRequired: true,
  },
  {
    id: "ojt_crit_overall",
    label: "Overall competency",
    description: "Final competency judgement for this OJT topic",
    order: 9,
    ratingScale: "pass_fail",
    isActive: true,
    isRequired: true,
  },
];

export function monthName(month: number): string {
  return CALENDAR_MONTHS.find((m) => m.number === month)?.name ?? String(month);
}

export function monthShort(month: number): string {
  return CALENDAR_MONTHS.find((m) => m.number === month)?.short ?? String(month);
}

export function currentCalendarYear(): number {
  return new Date().getFullYear();
}

export function currentCalendarMonth(): number {
  return new Date().getMonth() + 1;
}

export function plannerMark(
  selectionMonths: number[],
  executionMonths: number[],
  month: number
): OjtPlannerMark | "" {
  const s = selectionMonths.includes(month);
  const e = executionMonths.includes(month);
  if (s && e) return "S/E";
  if (s) return "S";
  if (e) return "E";
  return "";
}

export function lastDayOfMonthIso(year: number, month: number): string {
  const d = new Date(year, month, 0, 23, 59, 59, 999);
  return d.toISOString();
}

export function parseCalendarDateParts(
  isoDate: string
): { year: number; month: number; day: number } | null {
  const match = isoDate.trim().slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Store date-only inputs at noon UTC so the calendar day is stable across timezones. */
export function calendarDateToIso(dateStr: string): string {
  const parts = parseCalendarDateParts(dateStr);
  if (!parts) return new Date(dateStr).toISOString();
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}T12:00:00.000Z`;
}

export function dateFallsInMonth(isoDate: string, year: number, month: number): boolean {
  const parts = parseCalendarDateParts(isoDate);
  if (parts) return parts.year === year && parts.month === month;
  const d = new Date(isoDate);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

/** blank → S → S/E → E → blank */
export function cyclePlannerMonth(
  selection: number[],
  execution: number[],
  month: number
): { selectionMonths: number[]; executionMonths: number[] } {
  const s = selection.includes(month);
  const e = execution.includes(month);
  if (!s && !e) {
    return {
      selectionMonths: [...selection, month].sort((a, b) => a - b),
      executionMonths: execution,
    };
  }
  if (s && !e) {
    return {
      selectionMonths: selection,
      executionMonths: [...execution, month].sort((a, b) => a - b),
    };
  }
  if (s && e) {
    return {
      selectionMonths: selection.filter((m) => m !== month),
      executionMonths: execution,
    };
  }
  return {
    selectionMonths: selection,
    executionMonths: execution.filter((m) => m !== month),
  };
}
