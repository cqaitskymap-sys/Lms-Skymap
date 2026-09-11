import type { Employee } from "@/types";
import type {
  OjtAssignment,
  OjtMatrixCellValue,
  OjtOfficialSelection,
  OjtPlan,
} from "@/types/ojt";
import { formatOfficialDate } from "@/lib/ojt/constants";
import { isOjtOverdue } from "@/lib/ojt/workflow";

const EXCLUDED_EMPLOYEE_STATUSES = new Set<Employee["status"]>([
  "draft",
  "pending_verification",
  "terminated",
  "inactive",
]);

export function scopeOjtEmployees(
  employees: Employee[],
  departmentId?: string
): Employee[] {
  let rows = employees.filter((e) => !EXCLUDED_EMPLOYEE_STATUSES.has(e.status));
  if (departmentId) {
    rows = rows.filter((e) => e.departmentId === departmentId);
  }
  return rows.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
  );
}

export function latestAssignmentForCell(
  assignments: OjtAssignment[],
  employeeId: string,
  topicId: string,
  year: number
): OjtAssignment | undefined {
  return assignments
    .filter(
      (a) =>
        a.employeeId === employeeId && a.topicId === topicId && a.year === year
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function matrixCellValue(
  plan: OjtPlan | undefined,
  assignment: OjtAssignment | undefined,
  employeeId: string,
  graceDays = 0
): OjtMatrixCellValue {
  const applicability = plan?.employeeSelections.find(
    (s) => s.employeeId === employeeId
  )?.applicability;

  const openAssignment =
    assignment && assignment.status !== "cancelled" ? assignment : undefined;

  if (applicability === "not_applicable" && !openAssignment) return "not_applicable";

  if (!openAssignment) {
    return applicability === "selected" ? "selected" : "not_set";
  }

  if (isOjtOverdue(openAssignment, new Date(), graceDays)) return "overdue";

  switch (openAssignment.status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "retraining_required":
      return "retraining_required";
    case "cancelled":
      return "cancelled";
    case "scheduled":
    case "rescheduled":
      return "scheduled";
    case "in_progress":
    case "trainer_completed":
    case "employee_acknowledged":
    case "verification_pending":
    case "qa_pending":
      return "in_progress";
    case "selected":
    case "assigned":
    case "draft":
      return "pending";
    default:
      return "pending";
  }
}

export function summarizeMatrix(values: OjtMatrixCellValue[]) {
  const counts = {
    total: values.length,
    selected: 0,
    scheduled: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    retraining: 0,
    overdue: 0,
    na: 0,
  };
  for (const v of values) {
    if (v === "not_applicable") counts.na += 1;
    else if (v === "completed") counts.completed += 1;
    else if (v === "scheduled") counts.scheduled += 1;
    else if (v === "failed") counts.failed += 1;
    else if (v === "retraining_required") counts.retraining += 1;
    else if (v === "overdue") counts.overdue += 1;
    else if (v === "selected" || v === "pending") {
      counts.selected += 1;
      counts.pending += 1;
    } else if (v === "in_progress") counts.pending += 1;
  }
  return counts;
}

export function employeeDisplayName(employee: Pick<Employee, "firstName" | "lastName">): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

/** Official PDF S-row value: ✓ / NA / blank. Digital workflow states stay off this cell. */
export function officialSelectionValue(
  plan: OjtPlan | undefined,
  employeeId: string
): OjtOfficialSelection {
  const applicability = plan?.employeeSelections.find((s) => s.employeeId === employeeId)?.applicability;
  if (applicability === "not_applicable") return "not_applicable";
  if (applicability === "selected") return "selected";
  return "empty";
}

export function officialSelectionLabel(value: OjtOfficialSelection): string {
  if (value === "selected") return "✓";
  if (value === "not_applicable") return "NA";
  return "";
}

/** Official PDF E-row value: execution date, else blank. NA employees stay blank (not overdue). */
export function officialExecutionLabel(
  plan: OjtPlan | undefined,
  assignment: OjtAssignment | undefined,
  employeeId: string
): string {
  const selection = officialSelectionValue(plan, employeeId);
  if (selection === "not_applicable") return "";
  if (assignment?.actualExecutionDate && assignment.status !== "cancelled") {
    return formatOfficialDate(assignment.actualExecutionDate);
  }
  return "";
}

export function matrixCellIsLocked(assignment: OjtAssignment | undefined): boolean {
  if (!assignment || assignment.status === "cancelled") return false;
  return !["selected", "draft", "assigned"].includes(assignment.status);
}
