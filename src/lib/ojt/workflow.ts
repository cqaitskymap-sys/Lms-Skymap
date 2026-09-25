import type { OjtApprovalConfig, OjtAssignment, OjtCriterionScore, OjtStatus } from "@/types/ojt";
import { lastDayOfMonthIso, OPEN_OJT_STATUSES, TERMINAL_OJT_STATUSES } from "@/lib/ojt/constants";

const TRANSITIONS: Record<OjtStatus, readonly OjtStatus[]> = {
  draft: ["selected", "cancelled"],
  selected: ["assigned", "scheduled", "cancelled"],
  assigned: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled", "rescheduled"],
  // Employee ack can be disabled in settings — evaluation then jumps to HOD / QA / completed.
  in_progress: [
    "trainer_completed",
    "failed",
    "cancelled",
    "verification_pending",
    "qa_pending",
    "completed",
  ],
  trainer_completed: [
    "employee_acknowledged",
    "verification_pending",
    "qa_pending",
    "completed",
    "failed",
    "cancelled",
  ],
  employee_acknowledged: ["verification_pending", "qa_pending", "completed", "cancelled"],
  verification_pending: ["qa_pending", "completed", "failed", "retraining_required", "in_progress", "trainer_completed", "cancelled"],
  qa_pending: ["completed", "failed", "retraining_required", "verification_pending", "cancelled"],
  completed: [],
  failed: ["retraining_required", "cancelled"],
  retraining_required: ["rescheduled", "cancelled"],
  rescheduled: ["scheduled", "in_progress", "cancelled"],
  cancelled: [],
};

export function canTransition(from: OjtStatus, to: OjtStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: OjtStatus, to: OjtStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid OJT status change: ${from} → ${to}`);
  }
}

export function isTerminalOjtStatus(status: OjtStatus): boolean {
  return (TERMINAL_OJT_STATUSES as readonly string[]).includes(status);
}

export function isOpenOjtStatus(status: OjtStatus): boolean {
  return (OPEN_OJT_STATUSES as readonly string[]).includes(status);
}

/** Settings override each criterion's own scale. "both" keeps the criterion scale. */
export function criterionScaleForModel(
  criterionScale: "1-5" | "pass_fail",
  model: "pass_fail" | "rating_1_5" | "both" | undefined
): "1-5" | "pass_fail" {
  if (model === "pass_fail") return "pass_fail";
  if (model === "rating_1_5") return "1-5";
  return criterionScale;
}

/** 1–5 scores below 3, or any explicit Fail, mean not competent. */
export function criterionIsFail(score: Pick<OjtCriterionScore, "result" | "rating">): boolean {
  if (score.result === "fail") return true;
  return typeof score.rating === "number" && score.rating < 3;
}

export function evaluationDidFail(criteria: OjtCriterionScore[]): boolean {
  return criteria.some(criterionIsFail);
}

export function evaluationOverallRating(criteria: OjtCriterionScore[]): number | undefined {
  const ratings = criteria
    .map((s) => s.rating)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!ratings.length) return undefined;
  return Math.round((ratings.reduce((sum, n) => sum + n, 0) / ratings.length) * 10) / 10;
}

/**
 * Next status after trainer evaluation + sign-off, based on configurable approvals.
 */
export function statusAfterTrainerCompletion(config: OjtApprovalConfig, passed: boolean): OjtStatus {
  if (!passed) return "failed";
  if (config.requireEmployeeAck) return "trainer_completed";
  if (config.requireHodVerification) return "verification_pending";
  if (config.requireQaApproval) return "qa_pending";
  return "completed";
}

export function statusAfterEmployeeAck(config: OjtApprovalConfig): OjtStatus {
  if (config.requireHodVerification) return "verification_pending";
  if (config.requireQaApproval) return "qa_pending";
  return "completed";
}

export function statusAfterHodDecision(
  config: OjtApprovalConfig,
  decision: "approved" | "rejected"
): OjtStatus {
  if (decision === "rejected") return "in_progress";
  if (config.requireQaApproval) return "qa_pending";
  return "completed";
}

export function statusAfterQaDecision(decision: "approved" | "rejected"): OjtStatus {
  if (decision === "rejected") return "verification_pending";
  return "completed";
}

export function isOjtOverdue(
  assignment: Pick<
    OjtAssignment,
    "status" | "year" | "plannedExecutionMonth" | "actualExecutionDate"
  >,
  now = new Date(),
  graceDays = 0
): boolean {
  if (isTerminalOjtStatus(assignment.status)) return false;
  if (assignment.status === "failed" || assignment.status === "retraining_required") {
    return false;
  }
  const deadline = new Date(lastDayOfMonthIso(assignment.year, assignment.plannedExecutionMonth));
  if (graceDays > 0) {
    deadline.setDate(deadline.getDate() + graceDays);
  }
  return now.getTime() > deadline.getTime();
}

export function displayOjtStatus(
  assignment: Pick<
    OjtAssignment,
    "status" | "year" | "plannedExecutionMonth" | "actualExecutionDate"
  >,
  now = new Date(),
  graceDays = 0
): OjtStatus | "overdue" {
  if (isOjtOverdue(assignment, now, graceDays)) return "overdue";
  return assignment.status;
}
