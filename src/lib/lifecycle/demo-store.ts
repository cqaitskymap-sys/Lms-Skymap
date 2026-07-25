/**
 * Demo-mode persistence for employee lifecycle (localStorage).
 * Used when NEXT_PUBLIC_DEMO_MODE=true so the full workflow is exercisable offline.
 */

import type {
  Employee,
  LifecycleApproval,
  LifecycleEvent,
  LifecycleStage,
  Notification,
} from "@/types";
import { DEMO_EMPLOYEES, DEMO_DEPARTMENTS, isDemoMode } from "@/lib/demo/data";
import { getProgressForStage } from "@/lib/lifecycle/stages";
import { generateId, nowISO } from "@/lib/services/helpers";

const STORE_KEY = "pharma_lms_lifecycle_v1";

export interface LifecycleStore {
  employees: Employee[];
  events: LifecycleEvent[];
  approvals: LifecycleApproval[];
  notifications: Notification[];
}

function seedEmployees(): Employee[] {
  return DEMO_EMPLOYEES.map((e) => {
    let stage: LifecycleStage = "created";
    if (e.status === "draft") stage = "created";
    else if (e.status === "induction") stage = "induction_assigned";
    else if (e.id === "emp_001") stage = "qualified";
    return {
      ...e,
      lifecycleStage: stage,
      lifecycleProgress: getProgressForStage(stage),
      status:
        stage === "qualified"
          ? "qualified"
          : e.status === "draft"
            ? "draft"
            : e.status === "induction"
              ? "induction"
              : e.status,
    };
  });
}

function seedEvents(employees: Employee[]): LifecycleEvent[] {
  const events: LifecycleEvent[] = [];
  for (const emp of employees) {
    const stages: LifecycleStage[] =
      emp.id === "emp_001"
        ? [
            "created",
            "hr_verification",
            "induction_assigned",
            "induction_completed",
            "department_handover",
            "jd_created",
            "tni_created",
            "trainer_assigned",
            "sop_assigned",
            "training",
            "exam",
            "passed",
            "certified",
            "qualified",
          ]
        : emp.id === "emp_002"
          ? ["created", "hr_verification", "induction_assigned"]
          : ["created"];

    stages.forEach((stage, i) => {
      const isCurrent = stage === emp.lifecycleStage;
      const isPast = i < stages.indexOf(emp.lifecycleStage);
      events.push({
        id: `lev_${emp.id}_${stage}`,
        employeeId: emp.id,
        stage,
        title: stage.replace(/_/g, " "),
        description: `Lifecycle: ${stage}`,
        status: isCurrent ? "current" : isPast || emp.lifecycleStage === "qualified" ? "completed" : "upcoming",
        actorId: "user_hr",
        actorName: "Priya Sharma",
        actorRole: "hr",
        completedAt: isPast || emp.lifecycleStage === "qualified" ? emp.updatedAt : undefined,
        createdAt: emp.createdAt,
      });
    });
  }
  return events;
}

function defaultStore(): LifecycleStore {
  const employees = seedEmployees();
  return {
    employees,
    events: seedEvents(employees),
    approvals: [
      {
        id: "appr_001",
        employeeId: "emp_003",
        type: "hr_verification",
        title: "Verify new joiner",
        description: "Confirm documents and eligibility for Rohan Das",
        status: "pending",
        requestedBy: "system",
        requestedByName: "System",
        requestedAt: nowISO(),
        stage: "hr_verification",
      },
    ],
    notifications: [],
  };
}

export function readLifecycleStore(): LifecycleStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const seeded = defaultStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as LifecycleStore;
  } catch {
    return defaultStore();
  }
}

export function writeLifecycleStore(store: LifecycleStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("pharma-lifecycle-updated"));
}

export function resetLifecycleStore(): LifecycleStore {
  const seeded = defaultStore();
  writeLifecycleStore(seeded);
  return seeded;
}

export function demoDepartments() {
  return DEMO_DEPARTMENTS;
}

export function ensureDemoMode(): boolean {
  return isDemoMode();
}

export function upsertDemoEmployee(employee: Employee): Employee {
  const store = readLifecycleStore();
  const idx = store.employees.findIndex((e) => e.id === employee.id);
  if (idx >= 0) store.employees[idx] = employee;
  else store.employees.unshift(employee);
  writeLifecycleStore(store);
  return employee;
}

export function appendDemoEvent(event: LifecycleEvent): void {
  const store = readLifecycleStore();
  store.events = [event, ...store.events.filter((e) => !(e.employeeId === event.employeeId && e.stage === event.stage && e.status === "current"))];
  // Mark prior same-employee current as completed
  store.events = store.events.map((e) => {
    if (e.employeeId === event.employeeId && e.stage !== event.stage && e.status === "current") {
      return { ...e, status: "completed" as const, completedAt: e.completedAt || nowISO() };
    }
    return e;
  });
  writeLifecycleStore(store);
}

export function upsertDemoApproval(approval: LifecycleApproval): void {
  const store = readLifecycleStore();
  const idx = store.approvals.findIndex((a) => a.id === approval.id);
  if (idx >= 0) store.approvals[idx] = approval;
  else store.approvals.unshift(approval);
  writeLifecycleStore(store);
}

export function appendDemoNotification(notification: Notification): void {
  const store = readLifecycleStore();
  store.notifications.unshift(notification);
  writeLifecycleStore(store);
}

export function createDemoId(prefix: string) {
  return generateId(prefix);
}
