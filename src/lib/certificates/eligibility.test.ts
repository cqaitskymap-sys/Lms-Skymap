import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProgrammeEligibility, requiredExamsForEmployee } from "./eligibility";
import type { AssessmentAttempt, Exam } from "@/types";

function exam(partial: Partial<Exam> & Pick<Exam, "id" | "sopId">): Exam {
  return {
    title: partial.id,
    bankId: "b",
    questionCount: 1,
    durationMinutes: 10,
    passPercentage: 70,
    shuffleQuestions: false,
    shuffleOptions: false,
    randomizeFromBank: false,
    negativeMarkingEnabled: false,
    maxAttempts: 3,
    showResultsImmediately: true,
    autoSaveEnabled: false,
    autoSubmitOnTimeout: true,
    allowReview: false,
    leaderboardEnabled: false,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "qa",
    ...partial,
  };
}

test("programme eligibility ignores passes below the certificate threshold", () => {
  const required = [exam({ id: "e1", sopId: "s1" })];
  const low = {
    id: "a1",
    examId: "e1",
    employeeId: "emp",
    status: "passed",
    passed: true,
    certificateEligible: false,
    percentage: 80,
    startedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T01:00:00.000Z",
    questions: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "emp",
  } as AssessmentAttempt;
  const result = evaluateProgrammeEligibility(required, [low]);
  assert.equal(result.ready, false);
  assert.equal(result.remaining.length, 1);
});

test("only the latest active exam is required for each SOP", () => {
  const exams = [
    exam({ id: "old", sopId: "s1", updatedAt: "2026-01-01T00:00:00.000Z" }),
    exam({ id: "new", sopId: "s1", updatedAt: "2026-06-01T00:00:00.000Z" }),
    exam({ id: "other", sopId: "s2", isActive: false }),
  ];
  const required = requiredExamsForEmployee(exams, new Set(["s1", "s2"]));
  assert.deepEqual(required.map((row) => row.id), ["new"]);
});
