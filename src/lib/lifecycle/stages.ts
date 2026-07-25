import type { EmployeeStatus, LifecycleStage } from "@/types";

export interface StageDefinition {
  stage: LifecycleStage;
  order: number;
  label: string;
  description: string;
  /** Rough employment status mirror */
  employeeStatus: EmployeeStatus;
  progress: number;
  /** Roles that can advance this stage */
  actorRoles: string[];
}

export const LIFECYCLE_STAGES: StageDefinition[] = [
  {
    stage: "created",
    order: 0,
    label: "Employee Created",
    description: "Profile created by HR",
    employeeStatus: "draft",
    progress: 0,
    actorRoles: ["hr", "super_admin"],
  },
  {
    stage: "hr_verification",
    order: 1,
    label: "HR Verification",
    description: "HR verifies documents and eligibility",
    employeeStatus: "pending_verification",
    progress: 8,
    actorRoles: ["hr", "super_admin"],
  },
  {
    stage: "induction_assigned",
    order: 2,
    label: "Induction Assigned",
    description: "Onboarding modules assigned",
    employeeStatus: "induction",
    progress: 16,
    actorRoles: ["hr", "super_admin"],
  },
  {
    stage: "induction_completed",
    order: 3,
    label: "Induction Completed",
    description: "Induction modules and assessment passed",
    employeeStatus: "induction_complete",
    progress: 28,
    actorRoles: ["hr", "super_admin", "employee"],
  },
  {
    stage: "department_handover",
    order: 4,
    label: "Department Handover",
    description: "Handed over to department head",
    employeeStatus: "handed_over",
    progress: 36,
    actorRoles: ["hr", "super_admin"],
  },
  {
    stage: "jd_created",
    order: 5,
    label: "JD Created",
    description: "Job description drafted/approved",
    employeeStatus: "active",
    progress: 44,
    actorRoles: ["department_head", "hr", "super_admin"],
  },
  {
    stage: "tni_created",
    order: 6,
    label: "TNI Created",
    description: "Training needs identified",
    employeeStatus: "active",
    progress: 52,
    actorRoles: ["department_head", "hr", "super_admin"],
  },
  {
    stage: "trainer_assigned",
    order: 7,
    label: "Trainer Assigned",
    description: "Qualified trainer allocated",
    employeeStatus: "active",
    progress: 60,
    actorRoles: ["department_head", "qa", "super_admin"],
  },
  {
    stage: "sop_assigned",
    order: 8,
    label: "SOP Assigned",
    description: "Required SOPs assigned for training",
    employeeStatus: "active",
    progress: 68,
    actorRoles: ["department_head", "qa", "super_admin"],
  },
  {
    stage: "training",
    order: 9,
    label: "Training",
    description: "Classroom / OJT / self-paced training in progress",
    employeeStatus: "active",
    progress: 76,
    actorRoles: ["trainer", "department_head", "super_admin"],
  },
  {
    stage: "exam",
    order: 10,
    label: "Exam",
    description: "Assessment attempted",
    employeeStatus: "active",
    progress: 84,
    actorRoles: ["employee", "trainer", "super_admin"],
  },
  {
    stage: "passed",
    order: 11,
    label: "Pass",
    description: "Assessment passed",
    employeeStatus: "active",
    progress: 90,
    actorRoles: ["system", "super_admin", "qa"],
  },
  {
    stage: "certified",
    order: 12,
    label: "Certificate",
    description: "Training certificate issued",
    employeeStatus: "active",
    progress: 96,
    actorRoles: ["system", "qa", "super_admin"],
  },
  {
    stage: "qualified",
    order: 13,
    label: "Qualified Employee",
    description: "Employee fully qualified for role",
    employeeStatus: "qualified",
    progress: 100,
    actorRoles: ["qa", "department_head", "super_admin", "system"],
  },
];

export const STAGE_ORDER = LIFECYCLE_STAGES.map((s) => s.stage);

export function getStageDefinition(stage: LifecycleStage): StageDefinition {
  return LIFECYCLE_STAGES.find((s) => s.stage === stage) ?? LIFECYCLE_STAGES[0]!;
}

export function getStageIndex(stage: LifecycleStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function getProgressForStage(stage: LifecycleStage): number {
  return getStageDefinition(stage).progress;
}

export function canTransition(from: LifecycleStage, to: LifecycleStage): boolean {
  const fromIdx = getStageIndex(from);
  const toIdx = getStageIndex(to);
  // Allow forward by 1, or same stage refresh; block skipping more than 1 unless system catch-up
  return toIdx >= fromIdx && toIdx - fromIdx <= 1;
}

export function nextStage(stage: LifecycleStage): LifecycleStage | null {
  const idx = getStageIndex(stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1]!;
}

export function stageStatus(
  current: LifecycleStage,
  target: LifecycleStage
): "completed" | "current" | "upcoming" {
  const c = getStageIndex(current);
  const t = getStageIndex(target);
  if (t < c) return "completed";
  if (t === c) return "current";
  return "upcoming";
}
