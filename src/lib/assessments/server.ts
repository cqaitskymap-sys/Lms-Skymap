/**
 * Authoritative assessment start/submit via Firebase Admin SDK.
 * Used by /api/assessments/* so employees can take exams without
 * writing scored attempts or reading answer-key side effects client-side.
 */

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import {
  evaluateAttempt,
  sanitizeAttemptForClient,
  selectQuestionsForExam,
  toAttemptQuestions,
} from "@/lib/assessments/engine";
import { generateId } from "@/lib/services/helpers";
import { issueCertificateForAttemptServer } from "@/lib/certificates/issue-server";
import type {
  AssessmentAttempt,
  Exam,
  ExamResult,
  Question,
  TrainingAssignment,
} from "@/types";

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function loadExam(examId: string): Promise<Exam | null> {
  const snap = await adminDb.collection(COLLECTIONS.exams).doc(examId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Exam;
}

async function loadBankQuestions(exam: Exam): Promise<Question[]> {
  const bankIds = [exam.bankId, ...(exam.bankIds || [])];
  const all: Question[] = [];
  for (const bankId of bankIds) {
    const snap = await adminDb
      .collection(COLLECTIONS.questions)
      .where("bankId", "==", bankId)
      .where("isActive", "==", true)
      .get();
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question));
  }
  return all;
}

async function listAttemptsForEmployee(
  examId: string,
  employeeId: string
): Promise<AssessmentAttempt[]> {
  const snap = await adminDb
    .collection(COLLECTIONS.assessmentAttempts)
    .where("examId", "==", examId)
    .where("employeeId", "==", employeeId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AssessmentAttempt);
}

function attemptForPersistence(attempt: AssessmentAttempt): AssessmentAttempt {
  return {
    ...attempt,
    questions: attempt.questions.map((q) => {
      const { explanation: _e, ...rest } = q;
      return { ...rest, correctOptionIds: [], explanation: undefined };
    }),
  };
}

export type StartAssessmentServerInput = {
  examId: string;
  employeeId: string;
  employeeName?: string;
  assignmentId?: string;
  inductionAssignmentId?: string;
  actorId: string;
  /** When false, admins/testers can start past maxAttempts (preview only). */
  enforceMaxAttempts?: boolean;
};

export type StartAssessmentServerResult =
  | { ok: true; attempt: AssessmentAttempt; resumed: boolean }
  | { ok: false; status: number; error: string };

export async function startAssessmentServer(
  input: StartAssessmentServerInput
): Promise<StartAssessmentServerResult> {
  const exam = await loadExam(input.examId);
  if (!exam || !exam.isActive) {
    return { ok: false, status: 404, error: "Exam not found or inactive" };
  }

  if (input.assignmentId) {
    const assignSnap = await adminDb
      .collection(COLLECTIONS.trainingAssignments)
      .doc(input.assignmentId)
      .get();
    if (!assignSnap.exists) {
      return { ok: false, status: 400, error: "Training assignment not found" };
    }
    const assignment = assignSnap.data() as TrainingAssignment;
    if (assignment.employeeId !== input.employeeId) {
      return { ok: false, status: 403, error: "Assignment does not belong to this employee" };
    }
    if (assignment.status !== "assessment_pending" && assignment.status !== "retraining") {
      return {
        ok: false,
        status: 400,
        error: `Training assignment is not ready for assessment (status: ${assignment.status})`,
      };
    }
    if (exam.sopId && assignment.sopId && exam.sopId !== assignment.sopId) {
      return { ok: false, status: 400, error: "Exam is not linked to this SOP assignment" };
    }
  }

  const prior = await listAttemptsForEmployee(input.examId, input.employeeId);
  const open = prior
    .filter((a) => a.status === "in_progress")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  // Resume an open attempt that has not expired
  const now = new Date();
  const resumable = open.find((a) => new Date(a.expiresAt) > now);
  if (resumable) {
    return {
      ok: true,
      resumed: true,
      attempt: {
        ...resumable,
        questions: sanitizeAttemptForClient(resumable.questions, false),
      },
    };
  }

  // Expire stale open attempts
  const staleOpen = open.filter((a) => new Date(a.expiresAt) <= now);
  for (const stale of staleOpen) {
    await adminDb.collection(COLLECTIONS.assessmentAttempts).doc(stale.id).set(
      {
        status: "expired",
        updatedAt: now.toISOString(),
        updatedBy: input.actorId,
      },
      { merge: true }
    );
  }

  const enforceMaxAttempts = input.enforceMaxAttempts !== false;
  const finished = prior.filter((a) =>
    ["passed", "failed", "expired"].includes(a.status)
  );
  const stillOpen = open.length - staleOpen.length;
  if (enforceMaxAttempts && finished.length + staleOpen.length + stillOpen >= exam.maxAttempts) {
    return {
      ok: false,
      status: 400,
      error: `Maximum attempts (${exam.maxAttempts}) reached for this exam`,
    };
  }

  const pool = await loadBankQuestions(exam);
  const selected = selectQuestionsForExam(pool, exam);
  if (!selected.length) {
    return { ok: false, status: 400, error: "No questions available in the question bank" };
  }

  const expiresAt = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);
  const id = generateId("att");
  const attemptQuestions = toAttemptQuestions(selected, exam);

  const attempt: AssessmentAttempt = {
    id,
    examId: input.examId,
    examTitle: exam.title,
    employeeId: input.employeeId,
    status: "in_progress",
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastSavedAt: now.toISOString(),
    questions: attemptQuestions,
    answersDraft: {},
    maxScore: attemptQuestions.reduce((s, q) => s + q.marks, 0),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdBy: input.actorId,
    ...(input.employeeName ? { employeeName: input.employeeName } : {}),
    ...(input.assignmentId ? { assignmentId: input.assignmentId } : {}),
    ...(input.inductionAssignmentId
      ? { inductionAssignmentId: input.inductionAssignmentId }
      : {}),
  };

  await adminDb
    .collection(COLLECTIONS.assessmentAttempts)
    .doc(id)
    .set(stripUndefined(attemptForPersistence(attempt)));

  return {
    ok: true,
    resumed: false,
    attempt: {
      ...attempt,
      questions: sanitizeAttemptForClient(attempt.questions, false),
    },
  };
}

export type SubmitAssessmentServerInput = {
  attemptId: string;
  answers: Record<string, string[]>;
  actorId: string;
};

export type SubmitAssessmentServerResult =
  | { ok: true; attempt: AssessmentAttempt }
  | { ok: false; status: number; error: string };

export async function submitAssessmentServer(
  input: SubmitAssessmentServerInput
): Promise<SubmitAssessmentServerResult> {
  const attemptRef = adminDb.collection(COLLECTIONS.assessmentAttempts).doc(input.attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) {
    return { ok: false, status: 404, error: "Attempt not found" };
  }

  const attempt = { id: attemptSnap.id, ...attemptSnap.data() } as AssessmentAttempt;
  if (attempt.status !== "in_progress") {
    return { ok: false, status: 400, error: "Attempt already submitted" };
  }

  const exam = await loadExam(attempt.examId);
  if (!exam) {
    return { ok: false, status: 404, error: "Exam not found" };
  }

  const now = new Date();
  const expired = now > new Date(attempt.expiresAt);
  const mergedAnswers = { ...(attempt.answersDraft || {}), ...input.answers };

  const bankQuestions = await loadBankQuestions(exam);
  const keyById = new Map(
    bankQuestions.map((q) => [
      q.id,
      q.options.filter((o) => o.isCorrect).map((o) => o.id),
    ])
  );
  const questionsWithKeys = attempt.questions.map((q) => ({
    ...q,
    correctOptionIds: keyById.get(q.questionId) || [],
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
    updatedBy: input.actorId,
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
    createdBy: input.actorId,
  };

  // Rank among peers
  const peersSnap = await adminDb
    .collection(COLLECTIONS.examResults)
    .where("examId", "==", exam.id)
    .get();
  const peers = [
    ...peersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as ExamResult)
      .filter((r) => r.attemptId !== result.attemptId),
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

  await attemptRef.set(stripUndefined(updated));
  await adminDb.collection(COLLECTIONS.examResults).doc(result.id).set(stripUndefined(result));

  // Best-effort rank refresh for peers
  for (const peer of peers) {
    if (peer.attemptId === result.attemptId) continue;
    const peerDoc = peersSnap.docs.find((d) => d.data().attemptId === peer.attemptId);
    if (peerDoc) {
      await peerDoc.ref.set({ rank: peer.rank, updatedAt: now.toISOString() }, { merge: true });
    }
  }

  if (attempt.assignmentId) {
    await handleTrainingResultServer(attempt.assignmentId, updated, input.actorId);
  }

  if (attempt.inductionAssignmentId) {
    try {
      const nowIso = now.toISOString();
      await adminDb
        .collection(COLLECTIONS.inductionAssignments)
        .doc(attempt.inductionAssignmentId)
        .set(
          {
            status: updated.passed ? "passed" : "failed",
            score: updated.percentage,
            passed: !!updated.passed,
            assessmentAttemptId: attempt.id,
            ...(updated.passed ? { completedAt: nowIso, progressPercent: 100 } : {}),
            updatedAt: nowIso,
            updatedBy: input.actorId,
          },
          { merge: true }
        );
    } catch (err) {
      console.error("[submitAssessmentServer] induction update failed:", err);
    }
  }

  if (updated.passed && updated.certificateEligible) {
    try {
      await issueCertificateForAttemptServer(updated.id, input.actorId);
    } catch (err) {
      console.error("[submitAssessmentServer] certificate issue failed:", err);
    }
  }

  const reveal = !!exam.allowReview && !!exam.showResultsImmediately;
  return {
    ok: true,
    attempt: {
      ...updated,
      questions: sanitizeAttemptForClient(updated.questions, reveal),
    },
  };
}

async function handleTrainingResultServer(
  assignmentId: string,
  attempt: AssessmentAttempt,
  actorId: string
): Promise<void> {
  const now = new Date().toISOString();
  const assignRef = adminDb.collection(COLLECTIONS.trainingAssignments).doc(assignmentId);
  const assignSnap = await assignRef.get();
  if (!assignSnap.exists) return;
  const prev = { id: assignSnap.id, ...assignSnap.data() } as TrainingAssignment;

  if (attempt.passed) {
    let certificateId: string | undefined;
    if (attempt.certificateEligible) {
      const cert = await issueCertificateForAttemptServer(attempt.id, actorId);
      if (cert.ok) certificateId = cert.certificate.id;
    }

    await assignRef.set(
      {
        status: "passed",
        score: attempt.percentage,
        passed: true,
        assessmentAttemptId: attempt.id,
        ...(certificateId ? { certificateId } : {}),
        updatedAt: now,
        updatedBy: actorId,
      },
      { merge: true }
    );

    const stage = certificateId ? "certified" : "passed";
    const progress = certificateId ? 96 : 90;
    await adminDb
      .collection(COLLECTIONS.employees)
      .doc(attempt.employeeId)
      .set(
        {
          lifecycleStage: stage,
          lifecycleProgress: progress,
          status: "active",
          updatedAt: now,
          updatedBy: actorId,
        },
        { merge: true }
      );
    return;
  }

  await assignRef.set(
    {
      status: "failed",
      score: attempt.percentage,
      passed: false,
      assessmentAttemptId: attempt.id,
      updatedAt: now,
      updatedBy: actorId,
    },
    { merge: true }
  );

  const retrainId = generateId("ta");
  const due = new Date();
  due.setDate(due.getDate() + 7);
  const retraining: TrainingAssignment = {
    id: retrainId,
    employeeId: prev.employeeId,
    sopId: prev.sopId,
    sopVersionId: prev.sopVersionId,
    trainerId: prev.trainerId,
    assignedBy: actorId,
    departmentId: prev.departmentId,
    status: "retraining",
    dueDate: due.toISOString(),
    attemptCount: (prev.attemptCount || 0) + 1,
    isRetraining: true,
    previousAssignmentId: assignmentId,
    triggeredBySopRevision: false,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };
  await adminDb
    .collection(COLLECTIONS.trainingAssignments)
    .doc(retrainId)
    .set(stripUndefined(retraining));
}
