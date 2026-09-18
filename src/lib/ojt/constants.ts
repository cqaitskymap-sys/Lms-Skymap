import type {
  OjtApprovalConfig,
  OjtCompetencyScoringModel,
  OjtEvaluationCriterion,
  OjtFormApprovalConfig,
  OjtFormSignoffRole,
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

export const DEFAULT_OJT_FORM_APPROVALS: OjtFormApprovalConfig = {
  requirePreparedBy: true,
  requireCheckedByCoordinator: true,
  requireVerifiedByHod: true,
  requireCheckedByHead: true,
  requireApprovedByQa: true,
};

export const DEFAULT_PLANNER_FORM_NUMBER = "SOP/QA/002/F02-02";
export const DEFAULT_MATRIX_FORM_NUMBER = "SOP/QA/002/F15-00";
export const DEFAULT_OJT_COMPANY_NAME = "SKYMAP PHARMACEUTICALS PVT. LTD, ROORKEE";
export const DEFAULT_OJT_DIVISION = "QUALITY ASSURANCE";
export const DEFAULT_COMPETENCY_SCORING: OjtCompetencyScoringModel = "both";

export const OJT_FORM_SIGNOFF_LABELS: Record<OjtFormSignoffRole, { title: string; subtitle: string }> = {
  prepared_by: { title: "Prepared By", subtitle: "Officer/Executive" },
  checked_by_coordinator: { title: "Checked By", subtitle: "Department Training Coordinator" },
  verified_by_hod: { title: "Verified By", subtitle: "Department HOD/Designee" },
  checked_by_head: { title: "Checked By", subtitle: "Department Head" },
  approved_by_qa: { title: "Approved By", subtitle: "Head QA" },
};

export const DEFAULT_OJT_SETTINGS: Omit<OjtSettings, "createdAt" | "updatedAt" | "createdBy"> = {
  id: "global",
  ...DEFAULT_OJT_APPROVAL_CONFIG,
  overdueGraceDays: 0,
  allowExecutionBeforeSelection: false,
  requireExecutionDeviationApproval: true,
  competencyScoringModel: DEFAULT_COMPETENCY_SCORING,
  plannerFormNumber: DEFAULT_PLANNER_FORM_NUMBER,
  matrixFormNumber: DEFAULT_MATRIX_FORM_NUMBER,
  companyName: DEFAULT_OJT_COMPANY_NAME,
  companyDivision: DEFAULT_OJT_DIVISION,
  plannerApprovals: { ...DEFAULT_OJT_FORM_APPROVALS },
  matrixApprovals: { ...DEFAULT_OJT_FORM_APPROVALS },
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
  draft: "Not started",
  selected: "Needs trainer",
  assigned: "Needs date",
  scheduled: "Ready to train",
  in_progress: "Training started",
  trainer_completed: "Employee must confirm",
  employee_acknowledged: "Waiting for HOD",
  verification_pending: "HOD must check",
  qa_pending: "QA must approve",
  completed: "Done",
  failed: "Did not pass",
  retraining_required: "Needs retraining",
  rescheduled: "Retraining booked",
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

export function toggleMonthList(months: number[], month: number): number[] {
  return months.includes(month)
    ? months.filter((m) => m !== month)
    : [...months, month].sort((a, b) => a - b);
}

/**
 * Official PDF rule: execution month should not be earlier than selection month.
 * Exceptions are allowed only when the organisation enables them in settings.
 */
export function assertExecutionNotBeforeSelection(
  selectionMonths: number[],
  executionMonths: number[],
  allowBefore: boolean
): void {
  if (allowBefore) return;
  if (!selectionMonths.length || !executionMonths.length) return;
  const minS = Math.min(...selectionMonths);
  const minE = Math.min(...executionMonths);
  if (minE < minS) {
    throw new Error(
      "Execution month cannot be earlier than selection month. Enable exceptions in OJT settings if a deviation is authorized."
    );
  }
}

export function nextRevisionNumber(current: string | undefined): string {
  const n = Number.parseInt(current || "0", 10);
  const next = Number.isFinite(n) ? n + 1 : 1;
  return String(next).padStart(2, "0");
}

export function formatRevisionNumber(value: string | number | undefined): string {
  const n = Number.parseInt(String(value ?? "0"), 10);
  return String(Number.isFinite(n) ? n : 0).padStart(2, "0");
}

export function formatOfficialDate(iso?: string): string {
  if (!iso) return "";
  const parts = parseCalendarDateParts(iso);
  if (parts) {
    return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** blank → S → S/E → E → blank (legacy combined-cell helper; planner UI uses separate S/E rows). */
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
