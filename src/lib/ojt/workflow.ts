import type { OjtApprovalConfig, OjtAssignment, OjtStatus } from "@/types/ojt";
import { lastDayOfMonthIso, OPEN_OJT_STATUSES, TERMINAL_OJT_STATUSES } from "@/lib/ojt/constants";

const TRANSITIONS: Record<OjtStatus, readonly OjtStatus[]> = {
  draft: ["selected", "cancelled"],
  selected: ["assigned", "scheduled", "cancelled"],
  assigned: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled", "rescheduled"],
  in_progress: ["trainer_completed", "failed", "cancelled"],
  trainer_completed: [
    "employee_acknowledged",
    "verification_pending",
    "qa_pending",
    "completed",
    "failed",
    "cancelled",
  ],
  employee_acknowledged: ["verification_pending", "qa_pending", "completed", "cancelled"],
  verification_pending: ["qa_pending", "completed", "failed", "retraining_required", "cancelled"],
  qa_pending: ["completed", "failed", "retraining_required", "cancelled"],
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
  if (decision === "rejected") return "failed";
  if (config.requireQaApproval) return "qa_pending";
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
