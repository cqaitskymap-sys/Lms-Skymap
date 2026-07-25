/**
 * Assessment engine demo store — banks, questions, exams, attempts, results.
 */

import type {
  AssessmentAttempt,
  Exam,
  ExamResult,
  Question,
  QuestionBank,
} from "@/types";
import { DEMO_EXAMS, DEMO_QUESTIONS, isDemoMode } from "@/lib/demo/data";
import { generateId, nowISO } from "@/lib/services/helpers";

const STORE_KEY = "pharma_lms_assessments_v1";
export const ASSESSMENT_UPDATED_EVENT = "pharma-assessments-updated";

export interface AssessmentStore {
  banks: QuestionBank[];
  questions: Question[];
  exams: Exam[];
  attempts: AssessmentAttempt[];
  results: ExamResult[];
}

const SAMPLE_IMG =
  "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800&q=80";

function seedBanks(): QuestionBank[] {
  return [
    {
      id: "bank_001",
      name: "Document Control Bank",
      description: "GMP document control & SOP revision questions",
      sopId: "sop_001",
      departmentId: "dept_qa",
      questionCount: 0,
      difficultyMix: { easy: 40, medium: 40, hard: 20 },
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "user_qa",
    },
    {
      id: "bank_002",
      name: "Induction GMP Bank",
      description: "Company orientation & GMP basics",
      departmentId: "dept_qa",
      questionCount: 0,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "user_hr",
    },
  ];
}

function seedQuestions(): Question[] {
  const base = DEMO_QUESTIONS.map((q) => ({
    ...q,
    negativeMarks: q.difficulty === "hard" ? 0.5 : 0,
  })) as Question[];

  const extras: Question[] = [
    {
      id: "q_004",
      bankId: "bank_001",
      text: "Which actions are required when an SOP is revised? (Select all that apply)",
      type: "multi_select",
      options: [
        { id: "o1", text: "Archive the previous version", isCorrect: true },
        { id: "o2", text: "Retrain affected personnel", isCorrect: true },
        { id: "o3", text: "Delete all historical records", isCorrect: false },
        { id: "o4", text: "Update the training matrix", isCorrect: true },
      ],
      explanation: "Revision triggers archival, retraining, and matrix updates — never delete audit history.",
      difficulty: "medium",
      marks: 3,
      negativeMarks: 1,
      tags: ["document-control", "revision"],
      sopId: "sop_001",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "user_qa",
    },
    {
      id: "q_005",
      bankId: "bank_001",
      text: "Based on the scenario, what is the correct first action?",
      type: "scenario",
      scenario: {
        title: "Uncontrolled print found on shop floor",
        narrative:
          "During a walkthrough, QA finds a printed SOP-QA-001 Rev 1.0 at a packaging line. The system shows Rev 2.0 is effective since last Monday. Operators say they printed it 'for convenience' last month.",
      },
      options: [
        { id: "o1", text: "Ignore if operators know the new revision", isCorrect: false },
        { id: "o2", text: "Quarantine the uncontrolled copy and raise a deviation", isCorrect: true },
        { id: "o3", text: "Allow use until end of shift", isCorrect: false },
        { id: "o4", text: "Ask IT to delete the PDF from shared drive only", isCorrect: false },
      ],
      explanation: "Uncontrolled documents must be removed and investigated under deviation/CAPA.",
      difficulty: "hard",
      marks: 4,
      negativeMarks: 1,
      tags: ["scenario", "document-control"],
      sopId: "sop_001",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "user_qa",
    },
    {
      id: "q_006",
      bankId: "bank_001",
      text: "Identify the correct document control status indicated by the label colour in the image.",
      type: "image",
      media: {
        type: "image",
        url: SAMPLE_IMG,
        alt: "Controlled document stamp sample",
      },
      options: [
        { id: "o1", text: "Obsolete / uncontrolled", isCorrect: false },
        { id: "o2", text: "Controlled / current", isCorrect: true },
        { id: "o3", text: "Draft only", isCorrect: false },
        { id: "o4", text: "External reference", isCorrect: false },
      ],
      explanation: "Controlled copies carry authorised stamps/labels as defined in Document Control SOP.",
      difficulty: "medium",
      marks: 2,
      negativeMarks: 0.5,
      tags: ["image", "document-control"],
      sopId: "sop_001",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "user_qa",
    },
    {
      id: "q_007",
      bankId: "bank_002",
      text: "GMP stands for Good Manufacturing Practice.",
      type: "true_false",
      options: [
        { id: "o1", text: "True", isCorrect: true },
        { id: "o2", text: "False", isCorrect: false },
      ],
      difficulty: "easy",
      marks: 1,
      negativeMarks: 0,
      tags: ["gmp", "induction"],
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "user_hr",
    },
  ];

  return [...base, ...extras];
}

function seedExams(): Exam[] {
  return DEMO_EXAMS.map((e, idx) => ({
    ...e,
    randomizeFromBank: true,
    negativeMarkingEnabled: idx === 0,
    defaultNegativeMarks: 0.25,
    autoSaveEnabled: true,
    autoSaveIntervalSeconds: 15,
    autoSubmitOnTimeout: true,
    allowReview: true,
    certificatePassPercentage: e.passPercentage,
    leaderboardEnabled: true,
    difficultyMix: { easy: 2, medium: 2, hard: 1 },
    questionCount: Math.min(5, e.questionCount + 2),
  }));
}

function defaultStore(): AssessmentStore {
  const questions = seedQuestions();
  const banks = seedBanks().map((b) => ({
    ...b,
    questionCount: questions.filter((q) => q.bankId === b.id && q.isActive).length,
  }));
  return {
    banks,
    questions,
    exams: seedExams(),
    attempts: [],
    results: [],
  };
}

export function readAssessmentStore(): AssessmentStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const seeded = defaultStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as AssessmentStore;
    // Migrate older seeds missing new exam flags
    if (parsed.exams?.length && parsed.exams[0].autoSaveEnabled === undefined) {
      const seeded = defaultStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    return defaultStore();
  }
}

export function writeAssessmentStore(store: AssessmentStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(ASSESSMENT_UPDATED_EVENT));
}

export function resetAssessmentStore(): AssessmentStore {
  const seeded = defaultStore();
  writeAssessmentStore(seeded);
  return seeded;
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
