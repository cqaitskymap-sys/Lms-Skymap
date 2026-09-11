import type { UserRole } from "@/types";
import type { OjtAssignment, OjtStatus } from "@/types/ojt";
import { OJT_STATUS_LABELS } from "@/lib/ojt/constants";
import { isOjtOverdue } from "@/lib/ojt/workflow";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";

export type OjtNextAction = {
  title: string;
  hint: string;
  waitingOn: string;
  href: string;
  canAct: boolean;
  tone: "default" | "warning" | "danger" | "success";
  formId?: string;
};

const RANK: Record<OjtStatus, number> = {
  draft: 0,
  selected: 1,
  assigned: 2,
  scheduled: 3,
  rescheduled: 3,
  in_progress: 4,
  trainer_completed: 5,
  employee_acknowledged: 6,
  verification_pending: 7,
  qa_pending: 8,
  completed: 9,
  failed: 4,
  retraining_required: 4,
  cancelled: -1,
};

export type OjtProgressStep = {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming" | "blocked";
};

export function ojtStatusLabel(status: string): string {
  if (status === "overdue") return "Overdue";
  return OJT_STATUS_LABELS[status as OjtStatus] ?? status.replace(/_/g, " ");
}

function can(role: UserRole | undefined, permission: Permission): boolean {
  return !!role && hasPermission(role, permission);
}

export function ojtWorkflowSteps(assignment: OjtAssignment): OjtProgressStep[] {
  const status = assignment.status;
  if (status === "cancelled") {
    return [{ key: "cancelled", label: "Cancelled", state: "blocked" }];
  }

  const failed = status === "failed" || status === "retraining_required";
  const keys: { key: string; label: string; currentWhen: OjtStatus[] }[] = [
    { key: "select", label: "Selected", currentWhen: ["draft", "selected"] },
    { key: "trainer", label: "Trainer", currentWhen: ["assigned"] },
    { key: "schedule", label: "Date booked", currentWhen: ["scheduled", "rescheduled"] },
    { key: "train", label: "Training", currentWhen: ["in_progress"] },
    { key: "evaluate", label: "Evaluated", currentWhen: failed ? ["failed", "retraining_required"] : [] },
  ];
  if (assignment.requireEmployeeAck) {
    keys.push({ key: "ack", label: "Employee", currentWhen: ["trainer_completed"] });
  }
  if (assignment.requireHodVerification) {
    keys.push({ key: "hod", label: "HOD", currentWhen: ["verification_pending"] });
  }
  if (assignment.requireQaApproval) {
    keys.push({ key: "qa", label: "QA", currentWhen: ["qa_pending"] });
  }
  keys.push({ key: "done", label: "Completed", currentWhen: ["completed"] });

  const currentKey =
    keys.find((k) => k.currentWhen.includes(status))?.key ??
    (status === "in_progress" ? "train" : status === "completed" ? "done" : keys[0]?.key);

  const currentIndex = keys.findIndex((k) => k.key === currentKey);

  return keys.map((step, index) => {
    if (failed && step.key === "evaluate") {
      return { key: step.key, label: step.label, state: "blocked" };
    }
    if (status === "completed") {
      return { key: step.key, label: step.label, state: "done" };
    }
    if (index < currentIndex) return { key: step.key, label: step.label, state: "done" };
    if (index === currentIndex) return { key: step.key, label: step.label, state: "current" };
    return { key: step.key, label: step.label, state: "upcoming" };
  });
}

export function ojtNextAction(
  assignment: OjtAssignment,
  role?: UserRole | null,
  graceDays = 0
): OjtNextAction {
  const href = `/dashboard/ojt/assignments/${assignment.id}`;
  const r = role ?? undefined;
  const overdue = isOjtOverdue(assignment, new Date(), graceDays);

  if (assignment.status === "completed") {
    return {
      title: "Training complete",
      hint: "This On Job Training record is closed.",
      waitingOn: "—",
      href,
      canAct: false,
      tone: "success",
    };
  }
  if (assignment.status === "cancelled") {
    return {
      title: "Cancelled",
      hint: "This OJT will not be executed.",
      waitingOn: "—",
      href,
      canAct: false,
      tone: "default",
    };
  }

  const byStatus: Partial<Record<OjtStatus, OjtNextAction>> = {
    draft: {
      title: "Finish selection",
      hint: "Confirm this employee on the training matrix.",
      waitingOn: "Department head",
      href: "/dashboard/ojt/matrix",
      canAct: can(r, "ojt:assign"),
      tone: "default",
      formId: "ojt-schedule",
    },
    selected: {
      title: "Assign a trainer",
      hint: "Pick who will demonstrate this activity on the shop floor.",
      waitingOn: "Department head",
      href,
      canAct: can(r, "ojt:assign"),
      tone: overdue ? "danger" : "warning",
      formId: "ojt-schedule",
    },
    assigned: {
      title: "Book a training date",
      hint: `Choose a date in ${monthHint(assignment)} and a location.`,
      waitingOn: "Department head",
      href: can(r, "ojt:schedule") ? "/dashboard/ojt/schedule" : href,
      canAct: can(r, "ojt:schedule"),
      tone: overdue ? "danger" : "warning",
      formId: "ojt-schedule",
    },
    scheduled: {
      title: "Start practical training",
      hint: "Trainer demonstrates the activity, then records notes and scores.",
      waitingOn: assignment.trainerName || "Trainer",
      href: `/dashboard/ojt/execution/${assignment.id}`,
      canAct: can(r, "ojt:conduct") || can(r, "ojt:evaluate"),
      tone: overdue ? "danger" : "default",
      formId: "ojt-execution",
    },
    rescheduled: {
      title: "Start retraining",
      hint: "A new attempt is ready. Conduct the practical session again.",
      waitingOn: assignment.trainerName || "Trainer",
      href: `/dashboard/ojt/execution/${assignment.id}`,
      canAct: can(r, "ojt:conduct") || can(r, "ojt:evaluate"),
      tone: "warning",
      formId: "ojt-execution",
    },
    in_progress: {
      title: "Submit evaluation",
      hint: "Score competency criteria and sign off as trainer.",
      waitingOn: assignment.trainerName || "Trainer",
      href,
      canAct: can(r, "ojt:evaluate"),
      tone: "default",
      formId: "ojt-evaluation",
    },
    trainer_completed: {
      title: "Employee acknowledgement",
      hint: "Trainee confirms they received and understood this OJT.",
      waitingOn: assignment.employeeName,
      href,
      canAct: can(r, "ojt:acknowledge"),
      tone: "warning",
      formId: "ojt-ack",
    },
    employee_acknowledged: {
      title: "Waiting for verification",
      hint: "HOD or QA will review the training record next.",
      waitingOn: assignment.requireHodVerification ? "Department head" : "QA",
      href,
      canAct: can(r, "ojt:verify") || can(r, "ojt:approve"),
      tone: "default",
    },
    verification_pending: {
      title: "HOD verification",
      hint: "Review the practical record, then verify or reject.",
      waitingOn: "Department head",
      href,
      canAct: can(r, "ojt:verify"),
      tone: "warning",
      formId: "ojt-hod",
    },
    qa_pending: {
      title: "QA approval",
      hint: "Final compliance sign-off to close this OJT.",
      waitingOn: "QA",
      href,
      canAct: can(r, "ojt:approve"),
      tone: "warning",
      formId: "ojt-qa",
    },
    failed: {
      title: "Schedule retraining",
      hint: "Competency was not demonstrated. Book a new attempt — history is kept.",
      waitingOn: "Department head",
      href,
      canAct: can(r, "ojt:retrain"),
      tone: "danger",
      formId: "ojt-retrain",
    },
    retraining_required: {
      title: "Book retraining date",
      hint: "Pick a new execution date. Previous scores stay in attempt history.",
      waitingOn: "Department head",
      href,
      canAct: can(r, "ojt:retrain"),
      tone: "danger",
      formId: "ojt-retrain",
    },
  };

  const action = byStatus[assignment.status] ?? {
    title: ojtStatusLabel(assignment.status),
    hint: "Open the record to continue.",
    waitingOn: "—",
    href,
    canAct: false,
    tone: "default" as const,
  };

  if (overdue && action.tone !== "danger" && action.tone !== "success") {
    return {
      ...action,
      title: `Overdue — ${action.title}`,
      hint: `${action.hint} Planned month has already passed.`,
      tone: "danger",
    };
  }
  return action;
}

function monthHint(assignment: OjtAssignment): string {
  const names = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[assignment.plannedExecutionMonth] || "the planned month"} ${assignment.year}`;
}

export function actionableOjtQueue(
  assignments: OjtAssignment[],
  role?: UserRole | null,
  limit = 6,
  graceDays = 0
): { assignment: OjtAssignment; action: OjtNextAction }[] {
  return assignments
    .filter((a) => a.status !== "completed" && a.status !== "cancelled")
    .map((assignment) => ({ assignment, action: ojtNextAction(assignment, role, graceDays) }))
    .filter((row) => row.action.canAct)
    .sort((a, b) => {
      const rankA = RANK[a.assignment.status] ?? 99;
      const rankB = RANK[b.assignment.status] ?? 99;
      if (a.action.tone === "danger" && b.action.tone !== "danger") return -1;
      if (b.action.tone === "danger" && a.action.tone !== "danger") return 1;
      return rankA - rankB;
    })
    .slice(0, limit);
}

export function waitingOjtQueue(
  assignments: OjtAssignment[],
  role?: UserRole | null,
  limit = 6,
  graceDays = 0
): { assignment: OjtAssignment; action: OjtNextAction }[] {
  return assignments
    .filter((a) => a.status !== "completed" && a.status !== "cancelled")
    .map((assignment) => ({ assignment, action: ojtNextAction(assignment, role, graceDays) }))
    .filter((row) => !row.action.canAct)
    .slice(0, limit);
}

export function ojtFormPendingActions(
  forms: { kind: "planner" | "matrix"; status: string; departmentName?: string; year: number; locked?: boolean }[],
  role?: UserRole | null
): OjtNextAction[] {
  const r = role ?? undefined;
  const actions: OjtNextAction[] = [];
  for (const form of forms) {
    if (form.locked || form.status === "approved") continue;
    const href = form.kind === "planner" ? "/dashboard/ojt/planner" : "/dashboard/ojt/matrix";
    const name = form.kind === "planner" ? "Yearly planner" : "Employee training matrix";
    if (form.status === "draft" && can(r, "ojt:write")) {
      actions.push({
        title: `${name} pending preparation`,
        hint: `${form.departmentName || "Department"} ${form.year} is still draft.`,
        waitingOn: "Officer/Executive",
        href,
        canAct: true,
        tone: "warning",
      });
    } else if (form.status === "prepared" && (can(r, "ojt:verify") || can(r, "ojt:write"))) {
      actions.push({
        title: `${name} pending check / HOD verification`,
        hint: "Department Training Coordinator / HOD sign-off is outstanding.",
        waitingOn: "Department head",
        href,
        canAct: can(r, "ojt:verify") || r === "department_head" || r === "qa" || r === "super_admin",
        tone: "warning",
      });
    } else if (form.status === "checked" && can(r, "ojt:approve")) {
      actions.push({
        title: `${name} pending QA approval`,
        hint: "Head QA approval is required before this controlled form is active.",
        waitingOn: "QA",
        href,
        canAct: true,
        tone: "warning",
      });
    }
  }
  return actions;
}
