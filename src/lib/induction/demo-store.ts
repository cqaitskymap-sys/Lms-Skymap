/**
 * Local induction store — empty by default (no seeded demo records).
 * Used when demo mode is on, or as offline cache for user-created data.
 */

import type { InductionAssignment, InductionModule } from "@/types";

const STORE_KEY = "pharma_lms_induction_v2";
export const INDUCTION_UPDATED_EVENT = "pharma-induction-updated";

export interface InductionStore {
  modules: InductionModule[];
  assignments: InductionAssignment[];
}

function emptyStore(): InductionStore {
  return { modules: [], assignments: [] };
}

export function readInductionStore(): InductionStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const store = emptyStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return store;
    }
    return JSON.parse(raw) as InductionStore;
  } catch {
    return emptyStore();
  }
}

export function writeInductionStore(store: InductionStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(INDUCTION_UPDATED_EVENT));
}

export function resetInductionStore(): InductionStore {
  const store = emptyStore();
  writeInductionStore(store);
  return store;
}
