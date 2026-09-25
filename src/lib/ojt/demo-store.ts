import type {
  OjtAssignment,
  OjtEvaluationCriterion,
  OjtFormDocument,
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
  formDocuments: OjtFormDocument[];
}

function emptyStore(): OjtStore {
  return {
    topics: [],
    plans: [],
    assignments: [],
    criteria: [],
    settings: null,
    formDocuments: [],
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
    const parsed = { ...emptyStore(), ...(JSON.parse(raw) as OjtStore) };
    parsed.formDocuments = parsed.formDocuments || [];
    parsed.topics = parsed.topics || [];
    parsed.plans = parsed.plans || [];
    parsed.assignments = parsed.assignments || [];
    parsed.criteria = parsed.criteria || [];
    return parsed;
  } catch {
    return emptyStore();
  }
}

export function writeOjtStore(store: OjtStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  notifyOjtUpdated();
}

let notifyTimer: ReturnType<typeof setTimeout> | null = null;

/** Coalesce bursts (month ticks, topic seed) into one reload. */
export function notifyOjtUpdated(): void {
  if (typeof window === "undefined") return;
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    window.dispatchEvent(new CustomEvent(OJT_UPDATED_EVENT));
  }, 400);
}

export function preferOjtLocal(): boolean {
  return isDemoMode();
}
