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
  /** Stable list identity when several forms share the same page path. */
  id?: string;
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

export function ojtStatusLabel(status: string, selfStudy?: boolean): string {
  if (
    selfStudy &&
    (status === "in_progress" || status === "selected" || status === "assigned")
  ) {
    return "Self study";
  }
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

  if (assignment.selfStudy) {
    const failed = status === "failed" || status === "retraining_required";
    const keys = [
      { key: "select", label: "Person chosen" },
      { key: "study", label: "Read SOP and exam" },
      { key: "done", label: "Done" },
    ];
    const currentKey = status === "completed" ? "done" : failed ? "study" : "study";
    const currentIndex = keys.findIndex((step) => step.key === currentKey);
    return keys.map((step, index) => {
      if (failed && step.key === "study") return { ...step, state: "blocked" as const };
      if (status === "completed") return { ...step, state: "done" as const };
      if (index < currentIndex) return { ...step, state: "done" as const };
      if (index === currentIndex) return { ...step, state: "current" as const };
      return { ...step, state: "upcoming" as const };
    });
  }

  const failed = status === "failed" || status === "retraining_required";
  const keys: { key: string; label: string; currentWhen: OjtStatus[] }[] = [
    { key: "select", label: "Person chosen", currentWhen: ["draft", "selected"] },
    { key: "trainer", label: "Trainer", currentWhen: ["assigned"] },
    { key: "schedule", label: "Date booked", currentWhen: ["scheduled", "rescheduled"] },
    { key: "train", label: "Training", currentWhen: ["in_progress"] },
    { key: "evaluate", label: "Scored", currentWhen: failed ? ["failed", "retraining_required"] : [] },
  ];
  if (assignment.requireEmployeeAck) {
    keys.push({ key: "ack", label: "Employee OK", currentWhen: ["trainer_completed"] });
  }
  if (assignment.requireHodVerification) {
    keys.push({ key: "hod", label: "HOD OK", currentWhen: ["verification_pending"] });
  }
  if (assignment.requireQaApproval) {
    keys.push({ key: "qa", label: "QA OK", currentWhen: ["qa_pending"] });
  }
  keys.push({ key: "done", label: "Done", currentWhen: ["completed"] });

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
      title: "Training is done",
      hint: "This record is closed. Nothing more to do.",
      waitingOn: "—",
      href,
      canAct: false,
      tone: "success",
    };
  }
  if (assignment.status === "cancelled") {
    return {
      title: "Cancelled",
      hint: "This training will not happen.",
      waitingOn: "—",
      href,
      canAct: false,
      tone: "default",
    };
  }

  if (assignment.selfStudy) {
    const failed = assignment.status === "failed" || assignment.status === "retraining_required";
    return {
      title: failed ? "Exam not passed" : "Read the SOP, then take the exam",
      hint: failed
        ? "Ask the department if this person should try the exam again. OJT does not issue a certificate."
        : "Log in with your employee ID, study the SOP, then sit the exam. OJT does not issue a certificate.",
      waitingOn: assignment.employeeName,
      href: assignment.sopId ? `/dashboard/sops/${assignment.sopId}` : href,
      canAct: r === "employee",
      tone: failed || overdue ? "danger" : "warning",
    };
  }

  const byStatus: Partial<Record<OjtStatus, OjtNextAction>> = {
    draft: {
      title: "Start self study",
      hint: "Open this record and start self study. The employee reads the SOP, then takes the exam.",
      waitingOn: "Department head",
      href,
      canAct: can(r, "ojt:assign") || can(r, "ojt:schedule"),
      tone: "default",
      formId: "ojt-schedule",
    },
    selected: {
      title: "Start self study",
      hint: "There is no trainer. Start self study so this person can read the SOP and take the exam.",
      waitingOn: "Department head",
      href,
      canAct: can(r, "ojt:assign") || can(r, "ojt:schedule"),
      tone: overdue ? "danger" : "warning",
      formId: "ojt-schedule",
    },
    assigned: {
      title: "Start self study",
      hint: "There is no trainer. Start self study so this person can read the SOP and take the exam.",
      waitingOn: "Department head",
      href,
      canAct: can(r, "ojt:assign") || can(r, "ojt:schedule"),
      tone: overdue ? "danger" : "warning",
      formId: "ojt-schedule",
    },
    scheduled: {
      title: "Start training",
      hint: "Trainer shows the job, writes notes, then scores.",
      waitingOn: assignment.trainerName || "Trainer",
      href: `/dashboard/ojt/execution/${assignment.id}`,
      canAct: can(r, "ojt:conduct") || can(r, "ojt:evaluate"),
      tone: overdue ? "danger" : "default",
      formId: "ojt-execution",
    },
    rescheduled: {
      title: "Start retraining",
      hint: "A new attempt is ready. Show the job again and score.",
      waitingOn: assignment.trainerName || "Trainer",
      href: `/dashboard/ojt/execution/${assignment.id}`,
      canAct: can(r, "ojt:conduct") || can(r, "ojt:evaluate"),
      tone: "warning",
      formId: "ojt-execution",
    },
    in_progress: {
      title: "Submit scores",
      hint: "Mark each skill pass or fail, then sign as trainer.",
      waitingOn: assignment.trainerName || "Trainer",
      href,
      canAct: can(r, "ojt:evaluate"),
      tone: "default",
      formId: "ojt-evaluation",
    },
    trainer_completed: {
      title: "Employee must confirm",
      hint: "The trainee ticks that they understood and can do the job.",
      waitingOn: assignment.employeeName,
      href,
      canAct: can(r, "ojt:acknowledge"),
      tone: "warning",
      formId: "ojt-ack",
    },
    employee_acknowledged: {
      title: "Waiting for a check",
      hint: "HOD or QA will review this record next.",
      waitingOn: assignment.requireHodVerification ? "Department head" : "QA",
      href,
      canAct: can(r, "ojt:verify") || can(r, "ojt:approve"),
      tone: "default",
    },
    verification_pending: {
      title: "HOD must check",
      hint: "Read the notes, then Verify or Reject.",
      waitingOn: "Department head",
      href,
      canAct: can(r, "ojt:verify"),
      tone: "warning",
      formId: "ojt-hod",
    },
    qa_pending: {
      title: "QA must approve",
      hint: "Final sign-off to close this training.",
      waitingOn: "QA",
      href,
      canAct: can(r, "ojt:approve"),
      tone: "warning",
      formId: "ojt-qa",
    },
    failed: {
      title: "Book retraining",
      hint: "The person did not pass. Book a new date — old scores stay in history.",
      waitingOn: "Department head",
      href,
      canAct: can(r, "ojt:retrain"),
      tone: "danger",
      formId: "ojt-retrain",
    },
    retraining_required: {
      title: "Book retraining date",
      hint: "Pick a new training day. Previous scores are kept.",
      waitingOn: "Department head",
      href,
      canAct: can(r, "ojt:retrain"),
      tone: "danger",
      formId: "ojt-retrain",
    },
  };

  const action = byStatus[assignment.status] ?? {
    title: ojtStatusLabel(assignment.status, assignment.selfStudy),
    hint: "Open the record to continue.",
    waitingOn: "—",
    href,
    canAct: false,
    tone: "default" as const,
  };

  if (overdue && action.tone !== "danger" && action.tone !== "success") {
    return {
      ...action,
      title: `Late — ${action.title}`,
      hint: `${action.hint} The planned training month has already passed.`,
      tone: "danger",
    };
  }
  return action;
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

function ojtFormActionHref(
  kind: "planner" | "matrix",
  year: number,
  departmentId?: string
): string {
  const path = kind === "planner" ? "/dashboard/ojt/planner" : "/dashboard/ojt/matrix";
  const params = new URLSearchParams({ year: String(year) });
  if (departmentId) params.set("departmentId", departmentId);
  return `${path}?${params.toString()}`;
}

export function ojtFormPendingActions(
  forms: {
    id?: string;
    kind: "planner" | "matrix";
    status: string;
    departmentId?: string;
    departmentName?: string;
    year: number;
    locked?: boolean;
  }[],
  role?: UserRole | null
): OjtNextAction[] {
  const r = role ?? undefined;
  const actions: OjtNextAction[] = [];
  const seen = new Set<string>();
  for (const form of forms) {
    if (form.locked || form.status === "approved") continue;
    const href = ojtFormActionHref(form.kind, form.year, form.departmentId);
    const name = form.kind === "planner" ? "Yearly plan" : "People list";
    const dept = form.departmentName || "Department";
    const id =
      form.id ||
      `${form.kind}-${form.departmentId || dept}-${form.year}-${form.status}-${href}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (form.status === "draft" && can(r, "ojt:write")) {
      actions.push({
        id,
        title: `Sign ${name} as prepared — ${dept}`,
        hint: `${dept} ${form.year} is still a draft.`,
        waitingOn: "You",
        href,
        canAct: true,
        tone: "warning",
      });
    } else if (form.status === "prepared" && (can(r, "ojt:verify") || can(r, "ojt:write"))) {
      actions.push({
        id,
        title: `HOD must check ${name} — ${dept}`,
        hint: "Department head sign-off is still needed.",
        waitingOn: "Department head",
        href,
        canAct: can(r, "ojt:verify") || r === "department_head" || r === "qa" || r === "super_admin",
        tone: "warning",
      });
    } else if (form.status === "checked" && can(r, "ojt:approve")) {
      actions.push({
        id,
        title: `QA must approve ${name} — ${dept}`,
        hint: "QA sign-off is needed before this form is locked.",
        waitingOn: "QA",
        href,
        canAct: true,
        tone: "warning",
      });
    }
  }
  return actions;
}
