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

/** Latest active SOP exam per SOP — induction papers and retired papers are excluded. */
export function requiredExamsForEmployee(exams: Exam[], sopIds: Set<string>): Exam[] {
  if (!sopIds.size) return [];
  const bySop = new Map<string, Exam>();
  for (const exam of exams) {
    if (!exam.isActive || !exam.sopId || !sopIds.has(exam.sopId) || exam.inductionModuleId) {
      continue;
    }
    const prev = bySop.get(exam.sopId);
    const recency = exam.updatedAt || exam.createdAt || "";
    const prevRecency = prev ? prev.updatedAt || prev.createdAt || "" : "";
    if (!prev || recency >= prevRecency) bySop.set(exam.sopId, exam);
  }
  return [...bySop.values()];
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
    if (attempt.preview) continue;
    if (attempt.status !== "passed" || !attempt.passed) continue;
    if (attempt.certificateEligible === false) continue;
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
