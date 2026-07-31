/**
 * Local lifecycle store — empty by default (no seeded demo employees).
 * Used when NEXT_PUBLIC_DEMO_MODE=true or as offline cache.
 */

import type {
  Employee,
  LifecycleApproval,
  LifecycleEvent,
  Notification,
} from "@/types";
import { getDepartmentsSync } from "@/lib/services/departments";
import { isDemoMode } from "@/lib/demo/data";
import { generateId, nowISO } from "@/lib/services/helpers";

const STORE_KEY = "pharma_lms_lifecycle_v2";

export interface LifecycleStore {
  employees: Employee[];
  events: LifecycleEvent[];
  approvals: LifecycleApproval[];
  notifications: Notification[];
}

function emptyStore(): LifecycleStore {
  return {
    employees: [],
    events: [],
    approvals: [],
    notifications: [],
  };
}

export function readLifecycleStore(): LifecycleStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const store = emptyStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return store;
    }
    return JSON.parse(raw) as LifecycleStore;
  } catch {
    return emptyStore();
  }
}

export function writeLifecycleStore(store: LifecycleStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("pharma-lifecycle-updated"));
}

export function resetLifecycleStore(): LifecycleStore {
  const store = emptyStore();
  writeLifecycleStore(store);
  return store;
}

export function demoDepartments() {
  return getDepartmentsSync();
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
  store.events = [
    event,
    ...store.events.filter(
      (e) =>
        !(
          e.employeeId === event.employeeId &&
          e.stage === event.stage &&
          e.status === "current"
        )
    ),
  ];
  store.events = store.events.map((e) => {
    if (
      e.employeeId === event.employeeId &&
      e.stage !== event.stage &&
      e.status === "current"
    ) {
      return {
        ...e,
        status: "completed" as const,
        completedAt: e.completedAt || nowISO(),
      };
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
