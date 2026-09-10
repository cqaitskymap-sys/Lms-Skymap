import type { AssessmentAttempt, Exam } from "@/types";

export function collectRequiredSopIds(params: {
  tniNeeds: Array<{ sopId?: string }>;
  assignments: Array<{ sopId?: string }>;
}): Set<string> {
  const sopIds = new Set<string>();
  for (const need of params.tniNeeds) {
    if (need.sopId) sopIds.add(need.sopId);
  }
  for (const assignment of params.assignments) {
    if (assignment.sopId) sopIds.add(assignment.sopId);
  }
  return sopIds;
}

/** Active SOP exams the employee must pass — induction papers are excluded. */
export function requiredExamsForEmployee(exams: Exam[], sopIds: Set<string>): Exam[] {
  if (!sopIds.size) return [];
  return exams.filter(
    (exam) =>
      exam.isActive &&
      !!exam.sopId &&
      sopIds.has(exam.sopId) &&
      !exam.inductionModuleId
  );
}

export function evaluateProgrammeEligibility(
  requiredExams: Exam[],
  attempts: AssessmentAttempt[]
): {
  ready: boolean;
  remaining: Exam[];
  examsCompleted: number;
  averagePercentage: number;
} {
  const bestByExam = new Map<string, AssessmentAttempt>();
  for (const attempt of attempts) {
    if (attempt.status !== "passed" || !attempt.passed) continue;
    const prev = bestByExam.get(attempt.examId);
    if (!prev || (attempt.percentage || 0) > (prev.percentage || 0)) {
      bestByExam.set(attempt.examId, attempt);
    }
  }

  const remaining = requiredExams.filter((exam) => !bestByExam.has(exam.id));
  const completed = requiredExams
    .map((exam) => bestByExam.get(exam.id))
    .filter((row): row is AssessmentAttempt => Boolean(row));
  const averagePercentage = completed.length
    ? Math.round(
        completed.reduce((sum, row) => sum + (row.percentage || 0), 0) / completed.length
      )
    : 0;

  return {
    ready: requiredExams.length > 0 && remaining.length === 0,
    remaining,
    examsCompleted: completed.length,
    averagePercentage,
  };
}
