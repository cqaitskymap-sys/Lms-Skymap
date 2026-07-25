/**
 * Demo / offline induction store — modules + assignments in localStorage.
 */

import type { InductionAssignment, InductionModule } from "@/types";
import { DEMO_INDUCTION_MODULES } from "@/lib/demo/data";
import { nowISO } from "@/lib/services/helpers";

const STORE_KEY = "pharma_lms_induction_v1";
export const INDUCTION_UPDATED_EVENT = "pharma-induction-updated";

export interface InductionStore {
  modules: InductionModule[];
  assignments: InductionAssignment[];
}

function seedAssignments(): InductionAssignment[] {
  const now = nowISO();
  return [
    {
      id: "inda_001",
      employeeId: "emp_001",
      moduleId: "ind_001",
      status: "passed",
      progressPercent: 100,
      documentsViewed: ["doc_001"],
      startedAt: "2026-06-05T00:00:00.000Z",
      completedAt: "2026-06-15T00:00:00.000Z",
      score: 92,
      passed: true,
      assessmentAttemptId: "att_demo_001",
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-15T00:00:00.000Z",
      createdBy: "user_hr",
    },
    {
      id: "inda_002",
      employeeId: "emp_001",
      moduleId: "ind_002",
      status: "passed",
      progressPercent: 100,
      documentsViewed: [],
      startedAt: "2026-06-08T00:00:00.000Z",
      completedAt: "2026-06-14T00:00:00.000Z",
      score: 88,
      passed: true,
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
      createdBy: "user_hr",
    },
    {
      id: "inda_003",
      employeeId: "emp_002",
      moduleId: "ind_001",
      status: "in_progress",
      progressPercent: 0,
      documentsViewed: [],
      createdAt: now,
      updatedAt: now,
      createdBy: "user_hr",
    },
    {
      id: "inda_004",
      employeeId: "emp_002",
      moduleId: "ind_002",
      status: "not_started",
      progressPercent: 0,
      documentsViewed: [],
      createdAt: now,
      updatedAt: now,
      createdBy: "user_hr",
    },
  ];
}

function seedModules(): InductionModule[] {
  return DEMO_INDUCTION_MODULES.map((m) =>
    m.id === "ind_001" ? { ...m, assessmentId: "exam_001" } : { ...m }
  );
}

function defaultStore(): InductionStore {
  return {
    modules: seedModules(),
    assignments: seedAssignments(),
  };
}

export function readInductionStore(): InductionStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const seeded = defaultStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as InductionStore;
  } catch {
    return defaultStore();
  }
}

export function writeInductionStore(store: InductionStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(INDUCTION_UPDATED_EVENT));
}

export function resetInductionStore(): InductionStore {
  const seeded = defaultStore();
  writeInductionStore(seeded);
  return seeded;
}
