/**
 * Local training store — JD, TNI, assignments, sessions, trainers, notifications.
 */

import type {
  JobDescription,
  Notification,
  TrainerProfile,
  TrainingAssignment,
  TrainingNeedIdentification,
  TrainingSession,
} from "@/types";
import { isDemoMode } from "@/lib/demo/data";

const STORE_KEY = "pharma_lms_training_v1";

export const TRAINING_UPDATED_EVENT = "pharma-training-updated";

export interface TrainingStore {
  jobDescriptions: JobDescription[];
  tnis: TrainingNeedIdentification[];
  assignments: TrainingAssignment[];
  sessions: TrainingSession[];
  trainers: TrainerProfile[];
  notifications: Notification[];
}

function emptyStore(): TrainingStore {
  return {
    jobDescriptions: [],
    tnis: [],
    assignments: [],
    sessions: [],
    trainers: [],
    notifications: [],
  };
}

export function readTrainingStore(): TrainingStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const store = emptyStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return store;
    }
    return { ...emptyStore(), ...(JSON.parse(raw) as TrainingStore) };
  } catch {
    return emptyStore();
  }
}

export function writeTrainingStore(store: TrainingStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(TRAINING_UPDATED_EVENT));
}

export function preferTrainingLocal(): boolean {
  return isDemoMode();
}
