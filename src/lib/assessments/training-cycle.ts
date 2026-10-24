/** Open training rows that still block a lifecycle "passed" stage. */
const OPEN_ASSIGNMENT = new Set([
  "assigned",
  "in_progress",
  "training_scheduled",
  "training_completed",
  "assessment_pending",
  "retraining",
]);

/** Every exam in the project allows this many takes. */
export const EXAM_MAX_ATTEMPTS = 3;

export function withExamAttemptLimit<T extends { maxAttempts?: number }>(exam: T): T {
  return { ...exam, maxAttempts: EXAM_MAX_ATTEMPTS };
}

export function attemptsRemaining(finishedInCycle: number, maxAttempts: number): boolean {
  const allowance = Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 1;
  return finishedInCycle < allowance;
}

/**
 * After one SOP assignment is passed, other required SOPs that are still open
 * or failed without a covering pass/retrain keep the employee in the exam stage.
 */
export function hasOutstandingTraining(
  assignments: { id: string; sopId?: string; status?: string }[],
  passedAssignmentId: string
): boolean {
  const rows = assignments.map((row) =>
    row.id === passedAssignmentId ? { ...row, status: "passed" } : row
  );

  return rows.some((row) => {
    if (row.id === passedAssignmentId) return false;
    const status = row.status || "";
    if (status === "passed") return false;
    if (OPEN_ASSIGNMENT.has(status)) return true;
    if (status === "failed" || status === "expired") {
      const covered = rows.some(
        (other) =>
          other.id !== row.id &&
          !!other.sopId &&
          other.sopId === row.sopId &&
          (other.status === "passed" || OPEN_ASSIGNMENT.has(other.status || ""))
      );
      return !covered;
    }
    return true;
  });
}
