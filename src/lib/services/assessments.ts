/**
 * Assessment engine service — start, autosave, submit, review, leaderboard, analytics.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore/lite";
import { auth, db, COLLECTIONS } from "@/lib/firebase/client";
import type {
  AssessmentAnalytics,
  AssessmentAttempt,
  Certificate,
  Exam,
  ExamResult,
  LeaderboardEntry,
  Question,
  QuestionBank,
  TrainingAssignment,
} from "@/types";
import { generateId, nowISO, addDays, stripUndefined } from "@/lib/services/helpers";
import { calculatePercentage } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo/data";
import {
  evaluateAttempt,
  sanitizeAttemptForClient,
  selectQuestionsForExam,
  toAttemptQuestions,
} from "@/lib/assessments/engine";
import {
  pushAttemptLocal,
  pushResultLocal,
  readAssessmentStore,
  writeAssessmentStore,
} from "@/lib/assessments/demo-store";

async function preferLocalData(): Promise<boolean> {
  if (isDemoMode()) return true;
  return false;
}

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required");
  const token = await user.getIdToken(true);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/** Persist attempts without answer keys / explanations (defense in depth). */
function attemptForPersistence(attempt: AssessmentAttempt): AssessmentAttempt {
  return {
    ...attempt,
    questions: attempt.questions.map((q) => {
      const { explanation: _e, ...rest } = q;
      return { ...rest, correctOptionIds: [], explanation: undefined };
    }),
  };
}

async function recountBankQuestions(bankId: string): Promise<number> {
  if (await preferLocalData()) {
    const store = readAssessmentStore();
    const count = store.questions.filter((q) => q.bankId === bankId && q.isActive).length;
    store.banks = store.banks.map((b) =>
      b.id === bankId ? { ...b, questionCount: count, updatedAt: nowISO() } : b
    );
    writeAssessmentStore(store);
    return count;
  }
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.questions),
      where("bankId", "==", bankId),
      where("isActive", "==", true)
    )
  );
  const count = snap.size;
  await updateDoc(doc(db, COLLECTIONS.questionBanks, bankId), {
    questionCount: count,
    updatedAt: nowISO(),
  });
  return count;
}

function normalizeQuestionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function validateQuestionPayload(
  data: Pick<Question, "text" | "type" | "options" | "marks" | "scenario">
): void {
  if (!data.text?.trim()) throw new Error("Question text is required");
  if (!(data.marks >= 1)) throw new Error("Marks must be at least 1");
  const filled = data.options.filter((o) => o.text.trim());
  if (filled.length < 2) throw new Error("Add at least 2 options");
  const correct = filled.filter((o) => o.isCorrect);
  if (!correct.length) throw new Error("Mark at least one correct option");
  if ((data.type === "mcq" || data.type === "true_false") && correct.length !== 1) {
    throw new Error("MCQ and True/False questions must have exactly one correct option");
  }
  if (data.type === "scenario" && !data.scenario?.narrative?.trim()) {
    throw new Error("Scenario questions require a narrative");
  }
}

async function loadExam(examId: string): Promise<Exam | null> {
  if (await preferLocalData()) {
    return readAssessmentStore().exams.find((e) => e.id === examId) || null;
  }
  const snap = await getDoc(doc(db, COLLECTIONS.exams, examId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Exam;
}

async function loadBankQuestions(exam: Exam): Promise<Question[]> {
  if (await preferLocalData()) {
    return readAssessmentStore().questions;
  }
  const bankIds = [exam.bankId, ...(exam.bankIds || [])];
  const all: Question[] = [];
  for (const bankId of bankIds) {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.questions),
        where("bankId", "==", bankId),
        where("isActive", "==", true)
      )
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question));
  }
  return all;
}

export async function listQuestionBanks(): Promise<QuestionBank[]> {
  if (await preferLocalData()) return readAssessmentStore().banks.filter((b) => b.isActive);
  const snap = await getDocs(collection(db, COLLECTIONS.questionBanks));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as QuestionBank)
    .filter((b) => b.isActive);
}

export async function listQuestions(filters?: {
  bankId?: string;
  difficulty?: string;
  type?: string;
}): Promise<Question[]> {
  let rows: Question[];
  if (await preferLocalData()) {
    rows = readAssessmentStore().questions;
  } else if (filters?.bankId) {
    try {
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.questions),
          where("bankId", "==", filters.bankId),
          where("isActive", "==", true)
        )
      );
      rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);
    } catch {
      const snap = await getDocs(collection(db, COLLECTIONS.questions));
      rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);
    }
  } else {
    const snap = await getDocs(collection(db, COLLECTIONS.questions));
    rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);
  }

  rows = rows.map((q) => ({ ...q, tags: q.tags || [] }));
  if (filters?.bankId) rows = rows.filter((q) => q.bankId === filters.bankId);
  if (filters?.difficulty) rows = rows.filter((q) => q.difficulty === filters.difficulty);
  if (filters?.type) rows = rows.filter((q) => q.type === filters.type);
  return rows.filter((q) => q.isActive);
}

export async function listExams(): Promise<Exam[]> {
  if (await preferLocalData()) return readAssessmentStore().exams.filter((e) => e.isActive);
  const snap = await getDocs(collection(db, COLLECTIONS.exams));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Exam)
    .filter((e) => e.isActive);
}

export async function getExam(id: string): Promise<Exam | null> {
  return loadExam(id);
}

export async function getAttempt(
  id: string,
  opts?: { revealAnswers?: boolean }
): Promise<AssessmentAttempt | null> {
  let attempt: AssessmentAttempt | null = null;
  if (await preferLocalData()) {
    attempt = readAssessmentStore().attempts.find((a) => a.id === id) || null;
  } else {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.assessmentAttempts, id));
      if (snap.exists()) attempt = { id: snap.id, ...snap.data() } as AssessmentAttempt;
    } catch {
      attempt = readAssessmentStore().attempts.find((a) => a.id === id) || null;
    }
  }
  if (!attempt) return null;

  const reveal =
    !!opts?.revealAnswers &&
    (attempt.status === "passed" ||
      attempt.status === "failed" ||
      attempt.status === "expired");

  return {
    ...attempt,
    questions: sanitizeAttemptForClient(attempt.questions, reveal),
  };
}

export async function startAssessment(params: {
  examId: string;
  employeeId: string;
  employeeName?: string;
  assignmentId?: string;
  inductionAssignmentId?: string;
  actorId?: string;
}): Promise<AssessmentAttempt> {
  if (!(await preferLocalData())) {
    const res = await fetch("/api/assessments/start", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        examId: params.examId,
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        assignmentId: params.assignmentId,
        inductionAssignmentId: params.inductionAssignmentId,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      attempt?: AssessmentAttempt;
    };
    if (!res.ok || !body.attempt) {
      throw new Error(body.error || "Could not start assessment");
    }
    return body.attempt;
  }

  const exam = await loadExam(params.examId);
  if (!exam) throw new Error("Exam not found");

  const prior = await listAttemptsForEmployee(params.examId, params.employeeId);
  const now = new Date();
  const open = prior.filter((a) => a.status === "in_progress");
  const resumable = open.find((a) => new Date(a.expiresAt) > now);
  if (resumable) {
    return {
      ...resumable,
      questions: sanitizeAttemptForClient(resumable.questions, false),
    };
  }

  const finished = prior.filter((a) =>
    ["passed", "failed", "expired"].includes(a.status)
  );
  if (finished.length + open.length >= exam.maxAttempts) {
    throw new Error(`Maximum attempts (${exam.maxAttempts}) reached for this exam`);
  }

  const pool = await loadBankQuestions(exam);
  const selected = selectQuestionsForExam(pool, exam);
  if (!selected.length) throw new Error("No questions available in the question bank");

  const expiresAt = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);
  const id = generateId("att");
  const actorId = params.actorId || params.employeeId;
  const attemptQuestions = toAttemptQuestions(selected, exam);

  const attempt: AssessmentAttempt = {
    id,
    examId: params.examId,
    examTitle: exam.title,
    employeeId: params.employeeId,
    status: "in_progress",
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastSavedAt: now.toISOString(),
    questions: attemptQuestions,
    answersDraft: {},
    maxScore: attemptQuestions.reduce((s, q) => s + q.marks, 0),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdBy: actorId,
    ...(params.employeeName ? { employeeName: params.employeeName } : {}),
    ...(params.assignmentId ? { assignmentId: params.assignmentId } : {}),
    ...(params.inductionAssignmentId
      ? { inductionAssignmentId: params.inductionAssignmentId }
      : {}),
  };

  pushAttemptLocal(attempt);
  return {
    ...attempt,
    questions: sanitizeAttemptForClient(attempt.questions, false),
  };
}

export async function autoSaveAssessment(
  attemptId: string,
  answers: Record<string, string[]>,
  actorId: string
): Promise<void> {
  const now = nowISO();
  if (await preferLocalData()) {
    const store = readAssessmentStore();
    const idx = store.attempts.findIndex((a) => a.id === attemptId);
    if (idx < 0) return;
    const attempt = store.attempts[idx];
    if (attempt.status !== "in_progress") return;
    store.attempts[idx] = {
      ...attempt,
      answersDraft: answers,
      questions: attempt.questions.map((q) => ({
        ...q,
        selectedOptionIds: answers[q.questionId] || q.selectedOptionIds,
        isAnswered: (answers[q.questionId] || []).length > 0,
      })),
      lastSavedAt: now,
      updatedAt: now,
      updatedBy: actorId,
    };
    writeAssessmentStore(store);
    return;
  }

  await updateDoc(doc(db, COLLECTIONS.assessmentAttempts, attemptId), {
    answersDraft: answers,
    lastSavedAt: now,
    updatedAt: now,
    updatedBy: actorId,
  });
}

export async function submitAssessment(
  attemptId: string,
  answers: Record<string, string[]>,
  actorId: string
): Promise<AssessmentAttempt> {
  if (!(await preferLocalData())) {
    const res = await fetch("/api/assessments/submit", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ attemptId, answers }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      attempt?: AssessmentAttempt;
    };
    if (!res.ok || !body.attempt) {
      throw new Error(body.error || "Could not submit assessment");
    }
    return body.attempt;
  }

  const attempt: AssessmentAttempt | null =
    readAssessmentStore().attempts.find((a) => a.id === attemptId) || null;
  let exam: Exam | null = null;

  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status !== "in_progress") throw new Error("Attempt already submitted");

  exam = await loadExam(attempt.examId);
  if (!exam) throw new Error("Exam not found");

  const now = new Date();
  const expired = now > new Date(attempt.expiresAt);
  const mergedAnswers = { ...(attempt.answersDraft || {}), ...answers };

  const bankQuestions = await loadBankQuestions(exam);
  const keyById = new Map(
    bankQuestions.map((q) => [
      q.id,
      q.options.filter((o) => o.isCorrect).map((o) => o.id),
    ])
  );
  const questionsWithKeys = attempt.questions.map((q) => ({
    ...q,
    correctOptionIds: keyById.get(q.questionId) || q.correctOptionIds || [],
  }));

  const evaluated = evaluateAttempt(questionsWithKeys, mergedAnswers, exam);
  const passed = !expired && evaluated.passed;
  const certificateEligible = !expired && evaluated.certificateEligible;

  const updated: AssessmentAttempt = {
    ...attempt,
    questions: evaluated.questions,
    answersDraft: mergedAnswers,
    status: expired ? "expired" : passed ? "passed" : "failed",
    submittedAt: now.toISOString(),
    score: evaluated.score,
    maxScore: evaluated.maxScore,
    percentage: evaluated.percentage,
    passed,
    certificateEligible,
    negativeMarksApplied: evaluated.negativeMarksApplied,
    timeSpentSeconds: Math.round(
      (now.getTime() - new Date(attempt.startedAt).getTime()) / 1000
    ),
    updatedAt: now.toISOString(),
    updatedBy: actorId,
  };

  const result: ExamResult = {
    id: generateId("res"),
    attemptId: updated.id,
    examId: updated.examId,
    examTitle: exam.title,
    employeeId: updated.employeeId,
    employeeName: updated.employeeName || updated.employeeId,
    percentage: updated.percentage!,
    score: updated.score!,
    maxScore: updated.maxScore!,
    passed: !!updated.passed,
    certificateEligible: !!updated.certificateEligible,
    timeSpentSeconds: updated.timeSpentSeconds || 0,
    difficultyBreakdown: evaluated.difficultyBreakdown,
    typeBreakdown: evaluated.typeBreakdown,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdBy: actorId,
  };

  const store = readAssessmentStore();
  const idx = store.attempts.findIndex((a) => a.id === attemptId);
  if (idx >= 0) store.attempts[idx] = updated;
  else store.attempts.unshift(updated);

  const peers = [
    ...store.results.filter((r) => r.examId === exam!.id && r.attemptId !== result.attemptId),
    result,
  ].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return a.timeSpentSeconds - b.timeSpentSeconds;
  });
  peers.forEach((r, i) => {
    r.rank = i + 1;
  });
  result.rank = peers.find((r) => r.attemptId === result.attemptId)?.rank;
  updated.rank = result.rank;
  if (idx >= 0) store.attempts[idx] = updated;

  store.results = [
    ...store.results.filter((r) => r.examId !== exam!.id),
    ...peers,
  ];
  writeAssessmentStore(store);

  if (attempt.assignmentId) {
    await handleTrainingAssessmentResult(attempt.assignmentId, updated, exam, actorId);
  }

  if (attempt.inductionAssignmentId) {
    try {
      const { completeInductionAssessment } = await import("@/lib/services/induction");
      await completeInductionAssessment({
        assignmentId: attempt.inductionAssignmentId,
        attemptId,
        percentage: updated.percentage!,
        passed: !!updated.passed,
        actorId,
        employeeId: attempt.employeeId,
      });
    } catch {
      /* non-blocking */
    }
  }

  if (updated.passed && updated.certificateEligible) {
    try {
      const { issueTrainingCertificate, listCertificates } =
        await import("@/lib/services/certificates");
      const existing = (await listCertificates()).find((c) => c.attemptId === updated.id);
      if (!existing) {
        await issueTrainingCertificate({
          employeeId: updated.employeeId,
          employeeName: updated.employeeName,
          trainingAssignmentId: updated.assignmentId || `standalone_${updated.id}`,
          sopId: exam.sopId || exam.inductionModuleId || `standalone_${exam.id}`,
          sopVersionId: exam.sopId ? "sopv_current" : "n/a",
          examId: exam.id,
          attemptId: updated.id,
          score: updated.score || 0,
          percentage: updated.percentage || 0,
          actorId,
        });
      }
    } catch (err) {
      console.error("[submitAssessment] certificate issue failed:", err);
    }
  }

  const reveal = !!exam.allowReview && !!exam.showResultsImmediately;
  return {
    ...updated,
    questions: sanitizeAttemptForClient(updated.questions, reveal),
  };
}

async function handleTrainingAssessmentResult(
  assignmentId: string,
  attempt: AssessmentAttempt,
  exam: Exam,
  actorId: string
) {
  const now = nowISO();

  if (await preferLocalData()) {
    try {
      const { updateAssignmentAfterAssessment } = await import("@/lib/services/training");
      await updateAssignmentAfterAssessment({
        assignmentId,
        passed: !!attempt.passed,
        score: attempt.percentage ?? attempt.score ?? 0,
        attemptId: attempt.id!,
        actorId,
      });
    } catch {
      /* non-blocking */
    }
    return;
  }

  if (attempt.passed) {
    let certId: string | undefined;
    if (attempt.certificateEligible) {
      const cert = await issueCertificate({
        employeeId: attempt.employeeId,
        trainingAssignmentId: assignmentId,
        examId: exam.id,
        attemptId: attempt.id!,
        score: attempt.score!,
        percentage: attempt.percentage!,
        actorId,
      });
      certId = cert.id;
    }

    await updateDoc(doc(db, COLLECTIONS.trainingAssignments, assignmentId), {
      status: "passed",
      score: attempt.percentage,
      passed: true,
      assessmentAttemptId: attempt.id,
      ...(certId ? { certificateId: certId } : {}),
      updatedAt: now,
      updatedBy: actorId,
    });

    try {
      const {
        markExamLifecycle,
        markPassedLifecycle,
        markCertifiedLifecycle,
        markQualifiedLifecycle,
      } = await import("@/lib/services/lifecycle");
      const actor = {
        uid: actorId,
        name: "Assessment Engine",
        role: "super_admin" as const,
      };
      await markExamLifecycle(attempt.employeeId, actor);
      await markPassedLifecycle(attempt.employeeId, actor, attempt.percentage);
      if (certId) {
        await markCertifiedLifecycle(attempt.employeeId, certId, actor);
        await markQualifiedLifecycle(attempt.employeeId, actor);
      }
    } catch {
      /* lifecycle may already be ahead */
    }
  } else {
    const assignSnap = await getDoc(doc(db, COLLECTIONS.trainingAssignments, assignmentId));
    if (!assignSnap.exists()) return;
    const prev = assignSnap.data() as TrainingAssignment;

    await updateDoc(doc(db, COLLECTIONS.trainingAssignments, assignmentId), {
      status: "failed",
      score: attempt.percentage,
      passed: false,
      assessmentAttemptId: attempt.id,
      updatedAt: now,
      updatedBy: actorId,
    });

    const retrainId = generateId("ta");
    const retraining: TrainingAssignment = {
      id: retrainId,
      employeeId: prev.employeeId,
      sopId: prev.sopId,
      sopVersionId: prev.sopVersionId,
      trainerId: prev.trainerId,
      assignedBy: actorId,
      departmentId: prev.departmentId,
      status: "retraining",
      dueDate: addDays(now, 7),
      attemptCount: (prev.attemptCount || 0) + 1,
      isRetraining: true,
      previousAssignmentId: assignmentId,
      triggeredBySopRevision: false,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
    };
    await setDoc(doc(db, COLLECTIONS.trainingAssignments, retrainId), stripUndefined(retraining));
  }
}

export async function issueCertificate(params: {
  employeeId: string;
  trainingAssignmentId: string;
  examId: string;
  attemptId: string;
  score: number;
  percentage: number;
  actorId: string;
  trainerId?: string;
}): Promise<Certificate> {
  if (!(await preferLocalData())) {
    const { issueCertificateForAttempt } = await import("@/lib/services/certificates");
    const viaApi = await issueCertificateForAttempt(params.attemptId);
    if (viaApi) return viaApi;
  }

  const { issueTrainingCertificate } = await import("@/lib/services/certificates");

  let sopId = `standalone_${params.examId}`;
  let sopVersionId = "n/a";
  let trainerId = params.trainerId;

  try {
    const { listTrainingAssignments } = await import("@/lib/services/training");
    const all = await listTrainingAssignments();
    const assignment = all.find((a) => a.id === params.trainingAssignmentId);
    if (assignment) {
      sopId = assignment.sopId;
      sopVersionId = assignment.sopVersionId;
      trainerId = trainerId || assignment.trainerId;
    } else if (!(await preferLocalData())) {
      const assignSnap = await getDoc(
        doc(db, COLLECTIONS.trainingAssignments, params.trainingAssignmentId)
      );
      if (assignSnap.exists()) {
        const row = assignSnap.data() as TrainingAssignment;
        sopId = row.sopId;
        sopVersionId = row.sopVersionId;
        trainerId = trainerId || row.trainerId;
      }
    }
  } catch {
    /* use standalone defaults */
  }

  return issueTrainingCertificate({
    employeeId: params.employeeId,
    trainingAssignmentId: params.trainingAssignmentId,
    sopId,
    sopVersionId,
    examId: params.examId,
    attemptId: params.attemptId,
    score: params.score,
    percentage: params.percentage,
    trainerId,
    actorId: params.actorId,
  });
}

export async function listAttemptsForEmployee(
  examId: string,
  employeeId: string
): Promise<AssessmentAttempt[]> {
  if (await preferLocalData()) {
    return readAssessmentStore().attempts.filter(
      (a) => a.examId === examId && a.employeeId === employeeId
    );
  }
  try {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.assessmentAttempts),
        where("examId", "==", examId),
        where("employeeId", "==", employeeId)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AssessmentAttempt);
  } catch {
    return readAssessmentStore().attempts.filter(
      (a) => a.examId === examId && a.employeeId === employeeId
    );
  }
}

export async function getLeaderboard(examId: string, topN = 20): Promise<LeaderboardEntry[]> {
  if (await preferLocalData()) {
    return readAssessmentStore()
      .results.filter((r) => r.examId === examId)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))
      .slice(0, topN)
      .map((r) => ({
        rank: r.rank || 0,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        percentage: r.percentage,
        score: r.score,
        timeSpentSeconds: r.timeSpentSeconds,
        passed: r.passed,
        submittedAt: r.createdAt,
        attemptId: r.attemptId,
      }));
  }

  try {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.examResults),
        where("examId", "==", examId),
        orderBy("percentage", "desc"),
        limit(topN)
      )
    );
    return snap.docs.map((d, i) => {
      const r = d.data() as ExamResult;
      return {
        rank: r.rank || i + 1,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        percentage: r.percentage,
        score: r.score,
        timeSpentSeconds: r.timeSpentSeconds,
        passed: r.passed,
        submittedAt: r.createdAt,
        attemptId: r.attemptId,
      };
    });
  } catch {
    return [];
  }
}

export async function getExamAnalytics(examId: string): Promise<AssessmentAnalytics | null> {
  const exam = await loadExam(examId);
  if (!exam) return null;

  let results: ExamResult[] = [];
  if (await preferLocalData()) {
    results = readAssessmentStore().results.filter((r) => r.examId === examId);
  } else {
    try {
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.examResults), where("examId", "==", examId))
      );
      results = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExamResult);
    } catch {
      results = readAssessmentStore().results.filter((r) => r.examId === examId);
    }
  }

  const attemptCount = results.length;
  const passCount = results.filter((r) => r.passed).length;
  const failCount = attemptCount - passCount;
  const averagePercentage = attemptCount
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / attemptCount)
    : 0;
  const averageTimeSeconds = attemptCount
    ? Math.round(results.reduce((s, r) => s + r.timeSpentSeconds, 0) / attemptCount)
    : 0;

  const difficultyAccuracy = { easy: 0, medium: 0, hard: 0 };
  const diffTotals = { easy: 0, medium: 0, hard: 0 };
  const typeAccuracy: AssessmentAnalytics["typeAccuracy"] = {};
  const typeTotals: Record<string, { c: number; t: number }> = {};

  for (const r of results) {
    if (r.difficultyBreakdown) {
      for (const d of ["easy", "medium", "hard"] as const) {
        diffTotals[d] += r.difficultyBreakdown[d].total;
        difficultyAccuracy[d] += r.difficultyBreakdown[d].correct;
      }
    }
    if (r.typeBreakdown) {
      for (const [t, v] of Object.entries(r.typeBreakdown)) {
        if (!v) continue;
        typeTotals[t] = typeTotals[t] || { c: 0, t: 0 };
        typeTotals[t].c += v.correct;
        typeTotals[t].t += v.total;
      }
    }
  }

  for (const d of ["easy", "medium", "hard"] as const) {
    difficultyAccuracy[d] = diffTotals[d]
      ? Math.round((difficultyAccuracy[d] / diffTotals[d]) * 100)
      : 0;
  }
  for (const [t, v] of Object.entries(typeTotals)) {
    typeAccuracy[t as keyof typeof typeAccuracy] = v.t
      ? Math.round((v.c / v.t) * 100)
      : 0;
  }

  const buckets = [
    { bucket: "0-39", count: 0 },
    { bucket: "40-59", count: 0 },
    { bucket: "60-79", count: 0 },
    { bucket: "80-100", count: 0 },
  ];
  for (const r of results) {
    if (r.percentage < 40) buckets[0].count++;
    else if (r.percentage < 60) buckets[1].count++;
    else if (r.percentage < 80) buckets[2].count++;
    else buckets[3].count++;
  }

  // Miss rates from attempts
  const missMap = new Map<string, { miss: number; total: number; text: string }>();
  const attempts = (await preferLocalData())
    ? readAssessmentStore().attempts.filter(
        (a) => a.examId === examId && a.status !== "in_progress"
      )
    : [];
  for (const a of attempts) {
    for (const q of a.questions) {
      const cur = missMap.get(q.questionId) || { miss: 0, total: 0, text: q.text };
      cur.total += 1;
      if (!q.isCorrect) cur.miss += 1;
      missMap.set(q.questionId, cur);
    }
  }
  const topMissedQuestionIds = [...missMap.entries()]
    .map(([questionId, v]) => ({
      questionId,
      missRate: v.total ? Math.round((v.miss / v.total) * 100) : 0,
      text: v.text,
    }))
    .sort((a, b) => b.missRate - a.missRate)
    .slice(0, 5);

  return {
    examId,
    examTitle: exam.title,
    attemptCount,
    passCount,
    failCount,
    passRate: attemptCount ? calculatePercentage(passCount, attemptCount) : 0,
    averagePercentage,
    averageTimeSeconds,
    certificateEligibleCount: results.filter((r) => r.certificateEligible).length,
    difficultyAccuracy,
    typeAccuracy,
    scoreDistribution: buckets,
    topMissedQuestionIds,
  };
}

export async function createQuestionBank(
  data: {
    name: string;
    description?: string;
    sopId?: string;
    departmentId?: string;
  },
  actorId: string
): Promise<QuestionBank> {
  const name = data.name.trim();
  if (!name) throw new Error("Bank name is required");

  const existing = await listQuestionBanks();
  if (existing.some((b) => b.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error("A question bank with this name already exists");
  }

  const id = generateId("qb");
  const now = nowISO();
  const bank: QuestionBank = {
    id,
    name,
    description: data.description?.trim(),
    sopId: data.sopId,
    departmentId: data.departmentId,
    questionCount: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  if (await preferLocalData()) {
    const store = readAssessmentStore();
    store.banks.push(bank);
    writeAssessmentStore(store);
    return bank;
  }

  await setDoc(doc(db, COLLECTIONS.questionBanks, id), stripUndefined(bank));
  return bank;
}

export async function createQuestion(
  data: Omit<Question, "id" | "createdAt" | "updatedAt" | "createdBy">,
  actorId: string
): Promise<Question> {
  validateQuestionPayload(data);

  const existing = await listQuestions({ bankId: data.bankId });
  const normalized = normalizeQuestionText(data.text);
  if (existing.some((q) => normalizeQuestionText(q.text) === normalized)) {
    throw new Error("A similar question already exists in this bank");
  }

  const id = generateId("q");
  const now = nowISO();
  const question: Question = {
    ...data,
    text: data.text.trim(),
    tags: data.tags || [],
    options: data.options.map((o) => ({ ...o, text: o.text.trim() })),
    id,
    isActive: data.isActive !== false,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  if (await preferLocalData()) {
    const store = readAssessmentStore();
    store.questions.push(question);
    writeAssessmentStore(store);
    await recountBankQuestions(question.bankId);
    return question;
  }

  await setDoc(doc(db, COLLECTIONS.questions, id), stripUndefined(question));
  try {
    await recountBankQuestions(question.bankId);
  } catch {
    /* count update non-blocking */
  }
  return question;
}

export async function updateQuestion(
  questionId: string,
  patch: Partial<
    Pick<
      Question,
      | "text"
      | "type"
      | "options"
      | "explanation"
      | "difficulty"
      | "marks"
      | "negativeMarks"
      | "tags"
      | "scenario"
      | "isActive"
      | "bankId"
    >
  >,
  actorId: string
): Promise<Question> {
  let current: Question | null = null;
  if (await preferLocalData()) {
    current = readAssessmentStore().questions.find((q) => q.id === questionId) || null;
  } else {
    const snap = await getDoc(doc(db, COLLECTIONS.questions, questionId));
    if (snap.exists()) current = { id: snap.id, ...snap.data() } as Question;
  }
  if (!current) throw new Error("Question not found");

  const previousBankId = current.bankId;
  const nextType = patch.type ?? current.type;
  const next: Question = {
    ...current,
    ...patch,
    type: nextType,
    scenario: nextType === "scenario" ? patch.scenario ?? current.scenario : undefined,
    updatedAt: nowISO(),
    updatedBy: actorId,
  };
  validateQuestionPayload(next);

  if (await preferLocalData()) {
    const store = readAssessmentStore();
    store.questions = store.questions.map((q) => (q.id === questionId ? next : q));
    writeAssessmentStore(store);
    await recountBankQuestions(next.bankId);
    if (previousBankId !== next.bankId) await recountBankQuestions(previousBankId);
    return next;
  }

  await setDoc(doc(db, COLLECTIONS.questions, questionId), stripUndefined(next));
  await recountBankQuestions(next.bankId);
  if (previousBankId !== next.bankId) await recountBankQuestions(previousBankId);
  return next;
}

/** Soft-delete — hides from banks while preserving historical attempt references. */
export async function deactivateQuestion(
  questionId: string,
  actorId: string
): Promise<void> {
  await updateQuestion(questionId, { isActive: false }, actorId);
}

/** Super Admin only — permanently delete a question and recount the bank. */
export async function deleteQuestion(questionId: string): Promise<void> {
  if (await preferLocalData()) {
    const store = readAssessmentStore();
    const removed = store.questions.find((q) => q.id === questionId);
    store.questions = store.questions.filter((q) => q.id !== questionId);
    writeAssessmentStore(store);
    if (removed) await recountBankQuestions(removed.bankId);
    return;
  }

  const snap = await getDoc(doc(db, COLLECTIONS.questions, questionId));
  if (!snap.exists()) return;
  const bankId = (snap.data() as Question).bankId;
  await deleteDoc(doc(db, COLLECTIONS.questions, questionId));
  await recountBankQuestions(bankId);
}

/** Soft-deactivate a question bank (blocked if active exams reference it). */
export async function deactivateQuestionBank(
  bankId: string,
  actorId: string
): Promise<void> {
  const exams = await listExams();
  const linked = exams.filter(
    (e) => e.bankId === bankId || e.bankIds?.includes(bankId)
  );
  if (linked.length) {
    throw new Error(
      `Cannot deactivate bank — ${linked.length} active exam(s) still reference it`
    );
  }

  const now = nowISO();
  if (await preferLocalData()) {
    const store = readAssessmentStore();
    store.banks = store.banks.map((b) =>
      b.id === bankId ? { ...b, isActive: false, updatedAt: now, updatedBy: actorId } : b
    );
    writeAssessmentStore(store);
    return;
  }

  await updateDoc(doc(db, COLLECTIONS.questionBanks, bankId), {
    isActive: false,
    updatedAt: now,
    updatedBy: actorId,
  });
}

export async function createExam(
  data: Omit<Exam, "id" | "createdAt" | "updatedAt" | "createdBy">,
  actorId: string
): Promise<Exam> {
  if (data.questionCount < 1) throw new Error("Exam must include at least 1 question");
  if (data.durationMinutes < 1 || data.durationMinutes > 480) {
    throw new Error("Duration must be between 1 and 480 minutes");
  }
  if (data.passPercentage < 1 || data.passPercentage > 100) {
    throw new Error("Pass percentage must be between 1 and 100");
  }
  if (data.maxAttempts < 1 || data.maxAttempts > 20) {
    throw new Error("Max attempts must be between 1 and 20");
  }
  const certPass = data.certificatePassPercentage ?? data.passPercentage;
  if (certPass < data.passPercentage || certPass > 100) {
    throw new Error("Certificate pass % must be ≥ exam pass % and ≤ 100");
  }

  const pool = await loadBankQuestions({ ...data, id: "preview" } as Exam);
  const available = pool.filter(
    (q) =>
      q.isActive &&
      (q.bankId === data.bankId || data.bankIds?.includes(q.bankId))
  ).length;
  if (available > 0 && available < data.questionCount) {
    throw new Error(
      `Question bank has only ${available} active question(s); need ${data.questionCount}`
    );
  }

  const id = generateId("exam");
  const now = nowISO();
  const exam: Exam = {
    ...data,
    certificatePassPercentage: certPass,
    id,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  if (await preferLocalData()) {
    const store = readAssessmentStore();
    store.exams.push(exam);
    writeAssessmentStore(store);
    return exam;
  }

  await setDoc(doc(db, COLLECTIONS.exams, id), stripUndefined(exam));
  return exam;
}

/** Super Admin only — delete an exam definition. */
export async function deleteExam(examId: string): Promise<void> {
  if (await preferLocalData()) {
    const store = readAssessmentStore();
    store.exams = store.exams.filter((e) => e.id !== examId);
    store.attempts = store.attempts.filter((a) => a.examId !== examId);
    store.results = store.results.filter((r) => r.examId !== examId);
    writeAssessmentStore(store);
    return;
  }

  const [attempts, results] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.assessmentAttempts), where("examId", "==", examId))),
    getDocs(query(collection(db, COLLECTIONS.examResults), where("examId", "==", examId))),
  ]);
  await Promise.all([
    ...attempts.docs.map((d) => deleteDoc(d.ref)),
    ...results.docs.map((d) => deleteDoc(d.ref)),
  ]);
  await deleteDoc(doc(db, COLLECTIONS.exams, examId));
}
