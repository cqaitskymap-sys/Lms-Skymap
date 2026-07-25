/**
 * Local assessment store — empty by default (no seeded demo records).
 */

import type {
  AssessmentAttempt,
  Exam,
  ExamResult,
  Question,
  QuestionBank,
} from "@/types";
import { isDemoMode } from "@/lib/demo/data";
import { generateId, nowISO } from "@/lib/services/helpers";

const STORE_KEY = "pharma_lms_assessments_v2";
export const ASSESSMENT_UPDATED_EVENT = "pharma-assessments-updated";

export interface AssessmentStore {
  banks: QuestionBank[];
  questions: Question[];
  exams: Exam[];
  attempts: AssessmentAttempt[];
  results: ExamResult[];
}

function emptyStore(): AssessmentStore {
  return {
    banks: [],
    questions: [],
    exams: [],
    attempts: [],
    results: [],
  };
}

export function readAssessmentStore(): AssessmentStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const store = emptyStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return store;
    }
    return JSON.parse(raw) as AssessmentStore;
  } catch {
    return emptyStore();
  }
}

export function writeAssessmentStore(store: AssessmentStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(ASSESSMENT_UPDATED_EVENT));
}

export function resetAssessmentStore(): AssessmentStore {
  const store = emptyStore();
  writeAssessmentStore(store);
  return store;
}

export function shouldUseAssessmentLocalStore(): boolean {
  return isDemoMode();
}

export function pushAttemptLocal(attempt: AssessmentAttempt): void {
  const store = readAssessmentStore();
  const idx = store.attempts.findIndex((a) => a.id === attempt.id);
  if (idx >= 0) store.attempts[idx] = attempt;
  else store.attempts.unshift(attempt);
  writeAssessmentStore(store);
}

export function pushResultLocal(result: ExamResult): void {
  const store = readAssessmentStore();
  store.results = store.results.filter((r) => r.id !== result.id);
  store.results.unshift(result);
  writeAssessmentStore(store);
}

export function newLocalId(prefix: string): string {
  return generateId(prefix);
}

export function stampNow(): string {
  return nowISO();
}
