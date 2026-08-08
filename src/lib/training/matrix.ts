import type {
  Employee,
  SopDocument,
  TrainingAssignment,
  TrainingAssignmentStatus,
} from "@/types";

const EXCLUDED_EMPLOYEE_STATUSES = new Set<Employee["status"]>([
  "draft",
  "pending_verification",
  "terminated",
  "inactive",
]);

/** Most recent assignment for an employee × SOP cell. */
export function resolveLatestAssignment(
  assignments: TrainingAssignment[],
  employeeId: string,
  sopId: string
): TrainingAssignment | undefined {
  return assignments
    .filter((a) => a.employeeId === employeeId && a.sopId === sopId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** One row per employee×SOP cell — latest assignment only. */
export function latestAssignmentsByCell(
  assignments: TrainingAssignment[]
): TrainingAssignment[] {
  const map = new Map<string, TrainingAssignment>();
  for (const a of assignments) {
    const key = `${a.employeeId}:${a.sopId}`;
    const existing = map.get(key);
    if (!existing || a.createdAt.localeCompare(existing.createdAt) > 0) {
      map.set(key, a);
    }
  }
  return [...map.values()];
}

export function filterMatrixEmployees(employees: Employee[]): Employee[] {
  return employees.filter((e) => !EXCLUDED_EMPLOYEE_STATUSES.has(e.status));
}

export function filterMatrixSops(
  sops: SopDocument[],
  departmentId?: string
): SopDocument[] {
  let rows = sops.filter((s) => s.status === "approved");
  if (departmentId) {
    rows = rows.filter(
      (s) => !s.departmentIds?.length || s.departmentIds.includes(departmentId)
    );
  }
  return rows;
}

export function scopeMatrixEmployees(
  employees: Employee[],
  departmentId?: string
): Employee[] {
  let rows = filterMatrixEmployees(employees);
  if (departmentId) {
    rows = rows.filter((e) => e.departmentId === departmentId);
  }
  return rows.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
  );
}

export type MatrixCellStatus = TrainingAssignmentStatus | "not_assigned";

export function matrixCellStatus(
  assignment: TrainingAssignment | undefined,
  sop?: Pick<SopDocument, "currentVersionId">
): MatrixCellStatus {
  if (!assignment) return "not_assigned";
  if (
    assignment.status === "passed" &&
    sop?.currentVersionId &&
    assignment.sopVersionId &&
    assignment.sopVersionId !== sop.currentVersionId
  ) {
    return "retraining";
  }
  return assignment.status;
}

export function matrixCellLabel(status: MatrixCellStatus): string {
  if (status === "not_assigned") return "—";
  if (status === "passed") return "Pass";
  if (status === "failed") return "Fail";
  if (status === "assessment_pending") return "Assessment";
  if (status === "retraining") return "Retrain";
  return status.replace(/_/g, " ");
}

export function matrixExportColumnKey(s: SopDocument, allSops: SopDocument[]): string {
  const dupes = allSops.filter((x) => x.sopNumber === s.sopNumber).length > 1;
  return dupes ? `${s.sopNumber} (${s.id.slice(-6)})` : s.sopNumber;
}
