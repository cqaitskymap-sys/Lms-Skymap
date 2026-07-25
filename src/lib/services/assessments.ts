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
} from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/client";
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
import { generateId, nowISO, addDays } from "@/lib/services/helpers";
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
  try {
    const snap = await getDocs(query(collection(db, COLLECTIONS.exams), limit(1)));
    return snap.empty;
  } catch {
    return true;
  }
}

async function loadExam(examId: string): Promise<Exam | null> {
  if (await preferLocalData()) {
    return readAssessmentStore().exams.find((e) => e.id === examId) || null;
  }
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.exams, examId));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Exam;
  } catch {
    /* fall through */
  }
  return readAssessmentStore().exams.find((e) => e.id === examId) || null;
}

async function loadBankQuestions(exam: Exam): Promise<Question[]> {
  if (await preferLocalData()) {
    return readAssessmentStore().questions;
  }
  try {
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
    if (all.length) return all;
  } catch {
    /* fall through */
  }
  return readAssessmentStore().questions;
}

export async function listQuestionBanks(): Promise<QuestionBank[]> {
  if (await preferLocalData()) return readAssessmentStore().banks.filter((b) => b.isActive);
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.questionBanks));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as QuestionBank);
    if (rows.length) return rows.filter((b) => b.isActive);
  } catch {
    /* fall through */
  }
  return readAssessmentStore().banks.filter((b) => b.isActive);
}

export async function listQuestions(filters?: {
  bankId?: string;
  difficulty?: string;
  type?: string;
}): Promise<Question[]> {
  let rows =
    (await preferLocalData())
      ? readAssessmentStore().questions
      : await (async () => {
          try {
            const snap = await getDocs(collection(db, COLLECTIONS.questions));
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);
            return data.length ? data : readAssessmentStore().questions;
          } catch {
            return readAssessmentStore().questions;
          }
        })();

  if (filters?.bankId) rows = rows.filter((q) => q.bankId === filters.bankId);
  if (filters?.difficulty) rows = rows.filter((q) => q.difficulty === filters.difficulty);
  if (filters?.type) rows = rows.filter((q) => q.type === filters.type);
  return rows.filter((q) => q.isActive);
}

export async function listExams(): Promise<Exam[]> {
  if (await preferLocalData()) return readAssessmentStore().exams.filter((e) => e.isActive);
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.exams));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Exam);
    if (rows.length) return rows.filter((e) => e.isActive);
  } catch {
    /* fall through */
  }
  return readAssessmentStore().exams.filter((e) => e.isActive);
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
    opts?.revealAnswers ||
    attempt.status === "passed" ||
    attempt.status === "failed" ||
    attempt.status === "expired";

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
}): Promise<AssessmentAttempt> {
  const exam = await loadExam(params.examId);
  if (!exam) throw new Error("Exam not found");

  // Enforce max attempts
  const prior = await listAttemptsForEmployee(params.examId, params.employeeId);
  const finished = prior.filter((a) =>
    ["passed", "failed", "expired"].includes(a.status)
  );
  if (finished.length >= exam.maxAttempts) {
    throw new Error(`Maximum attempts (${exam.maxAttempts}) reached for this exam`);
  }

  const pool = await loadBankQuestions(exam);
  const selected = selectQuestionsForExam(pool, exam);
  if (!selected.length) throw new Error("No questions available in the question bank");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);
  const id = generateId("att");

  const attemptQuestions = toAttemptQuestions(selected, exam);

  const attempt: AssessmentAttempt = {
    id,
    examId: params.examId,
    examTitle: exam.title,
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    assignmentId: params.assignmentId,
    inductionAssignmentId: params.inductionAssignmentId,
    status: "in_progress",
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastSavedAt: now.toISOString(),
    questions: attemptQuestions,
    answersDraft: {},
    maxScore: attemptQuestions.reduce((s, q) => s + q.marks, 0),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdBy: params.employeeId,
  };

  if (await preferLocalData()) {
    pushAttemptLocal(attempt);
  } else {
    // Store full keys server-side; client getAttempt strips until submit
    await setDoc(doc(db, COLLECTIONS.assessmentAttempts, id), attempt);
  }

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
  const local = await preferLocalData();
  let attempt: AssessmentAttempt | null = null;
  let exam: Exam | null = null;

  if (local) {
    attempt = readAssessmentStore().attempts.find((a) => a.id === attemptId) || null;
  } else {
    const snap = await getDoc(doc(db, COLLECTIONS.assessmentAttempts, attemptId));
    if (snap.exists()) attempt = { id: snap.id, ...snap.data() } as AssessmentAttempt;
  }
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status !== "in_progress") throw new Error("Attempt already submitted");

  exam = await loadExam(attempt.examId);
  if (!exam) throw new Error("Exam not found");

  const now = new Date();
  const expired = now > new Date(attempt.expiresAt);
  const mergedAnswers = { ...(attempt.answersDraft || {}), ...answers };

  const evaluated = evaluateAttempt(attempt.questions, mergedAnswers, exam);
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

  if (local) {
    const store = readAssessmentStore();
    const idx = store.attempts.findIndex((a) => a.id === attemptId);
    if (idx >= 0) store.attempts[idx] = updated;
    else store.attempts.unshift(updated);

    const peers = [
      ...store.results.filter((r) => r.examId === exam.id && r.attemptId !== result.attemptId),
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
      ...store.results.filter((r) => r.examId !== exam.id),
      ...peers,
    ];
    writeAssessmentStore(store);
  } else {
    await setDoc(doc(db, COLLECTIONS.assessmentAttempts, attemptId), updated);
    await setDoc(doc(db, COLLECTIONS.examResults, result.id), result);
  }

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

  // Auto-issue training certificate when eligible (once per attempt)
  if (updated.passed && updated.certificateEligible) {
    try {
      const { issueTrainingCertificate, listCertificates } = await import(
        "@/lib/services/certificates"
      );
      const existing = (await listCertificates()).find((c) => c.attemptId === updated.id);
      if (!existing) {
        const examDoc = exam!;
        await issueTrainingCertificate({
          employeeId: updated.employeeId,
          employeeName: updated.employeeName,
          trainingAssignmentId: updated.assignmentId || `standalone_${updated.id}`,
          sopId: examDoc.sopId || "sop_001",
          sopVersionId: "sopv_current",
          examId: examDoc.id,
          attemptId: updated.id,
          score: updated.score || 0,
          percentage: updated.percentage || 0,
          trainerId: undefined,
          actorId,
        });
      }
    } catch {
      /* non-blocking — certificate page can re-issue */
    }
  }

  return updated;
}

async function handleTrainingAssessmentResult(
  assignmentId: string,
  attempt: AssessmentAttempt,
  exam: Exam,
  actorId: string
) {
  const now = nowISO();
  if (await preferLocalData()) {
    return;
  }

  if (attempt.passed) {
    const cert = await issueCertificate({
      employeeId: attempt.employeeId,
      trainingAssignmentId: assignmentId,
      examId: exam.id,
      attemptId: attempt.id!,
      score: attempt.score!,
      percentage: attempt.percentage!,
      actorId,
    });

    await updateDoc(doc(db, COLLECTIONS.trainingAssignments, assignmentId), {
      status: "passed",
      score: attempt.percentage,
      passed: true,
      assessmentAttemptId: attempt.id,
      certificateId: cert.id,
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
      await markCertifiedLifecycle(attempt.employeeId, cert.id, actor);
      await markQualifiedLifecycle(attempt.employeeId, actor);
    } catch {
      /* lifecycle may already be ahead */
    }
  } else {
    const assignSnap = await getDoc(doc(db, COLLECTIONS.trainingAssignments, assignmentId));
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
    await setDoc(doc(db, COLLECTIONS.trainingAssignments, retrainId), retraining);
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
  const { issueTrainingCertificate } = await import("@/lib/services/certificates");

  let sopId = "sop_001";
  let sopVersionId = "sopv_001";
  let trainerId = params.trainerId;

  if (!(await preferLocalData())) {
    try {
      const assignSnap = await getDoc(
        doc(db, COLLECTIONS.trainingAssignments, params.trainingAssignmentId)
      );
      if (assignSnap.exists()) {
        const assignment = assignSnap.data() as TrainingAssignment;
        sopId = assignment.sopId;
        sopVersionId = assignment.sopVersionId;
        trainerId = trainerId || assignment.trainerId;
      }
    } catch {
      /* use defaults */
    }
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

export async function createQuestion(
  data: Omit<Question, "id" | "createdAt" | "updatedAt" | "createdBy">,
  actorId: string
): Promise<Question> {
  const id = generateId("q");
  const now = nowISO();
  const question: Question = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  if (await preferLocalData()) {
    const store = readAssessmentStore();
    store.questions.push(question);
    store.banks = store.banks.map((b) =>
      b.id === question.bankId
        ? {
            ...b,
            questionCount: store.questions.filter((q) => q.bankId === b.id && q.isActive).length,
          }
        : b
    );
    writeAssessmentStore(store);
    return question;
  }

  await setDoc(doc(db, COLLECTIONS.questions, id), question);
  return question;
}

/** Super Admin only — delete a question from the bank. */
export async function deleteQuestion(questionId: string): Promise<void> {
  if (await preferLocalData()) {
    const store = readAssessmentStore();
    const removed = store.questions.find((q) => q.id === questionId);
    store.questions = store.questions.filter((q) => q.id !== questionId);
    if (removed) {
      store.banks = store.banks.map((b) =>
        b.id === removed.bankId
          ? {
              ...b,
              questionCount: store.questions.filter((q) => q.bankId === b.id && q.isActive)
                .length,
            }
          : b
      );
    }
    writeAssessmentStore(store);
    return;
  }

  await deleteDoc(doc(db, COLLECTIONS.questions, questionId));
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

  await deleteDoc(doc(db, COLLECTIONS.exams, examId));
}
