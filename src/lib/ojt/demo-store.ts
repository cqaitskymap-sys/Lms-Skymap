import type {
  OjtAssignment,
  OjtEvaluationCriterion,
  OjtPlan,
  OjtSettings,
  OjtTopic,
} from "@/types/ojt";
import { isDemoMode } from "@/lib/demo/data";

const STORE_KEY = "pharma_lms_ojt_v1";

export const OJT_UPDATED_EVENT = "pharma-ojt-updated";

export interface OjtStore {
  topics: OjtTopic[];
  plans: OjtPlan[];
  assignments: OjtAssignment[];
  criteria: OjtEvaluationCriterion[];
  settings: OjtSettings | null;
}

function emptyStore(): OjtStore {
  return {
    topics: [],
    plans: [],
    assignments: [],
    criteria: [],
    settings: null,
  };
}

export function readOjtStore(): OjtStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const store = emptyStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return store;
    }
    return { ...emptyStore(), ...(JSON.parse(raw) as OjtStore) };
  } catch {
    return emptyStore();
  }
}

export function writeOjtStore(store: OjtStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  notifyOjtUpdated();
}

export function notifyOjtUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OJT_UPDATED_EVENT));
  }
}

export function preferOjtLocal(): boolean {
  return isDemoMode();
}
