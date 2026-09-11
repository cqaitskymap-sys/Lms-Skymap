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
import { getProgressForStage, getStageIndex } from "@/lib/lifecycle/stages";
import type {
  AssessmentAttempt,
  Exam,
  ExamResult,
  LifecycleStage,
  Question,
  TrainingAssignment,
} from "@/types";

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function currentSopVersionId(sopId: string): Promise<string | undefined> {
  const snap = await adminDb.collection(COLLECTIONS.sops).doc(sopId).get();
  if (!snap.exists) return undefined;
  return (snap.data() as { currentVersionId?: string }).currentVersionId;
}

function ackMatchesVersion(
  acks: { sopId?: string; versionId?: string }[],
  sopId: string,
  currentVersionId?: string
): boolean {
  return acks.some((a) => {
    if (a.sopId !== sopId) return false;
    if (!currentVersionId) return true;
    return a.versionId === currentVersionId;
  });
}

async function assertTniSopsReadServer(params: {
  employeeId: string;
  userId: string;
  examSopId?: string;
}): Promise<StartAssessmentServerResult | null> {
  try {
    const [tniSnap, assignSnap, ackSnap] = await Promise.all([
      adminDb
        .collection(COLLECTIONS.tni)
        .where("employeeId", "==", params.employeeId)
        .get(),
      adminDb
        .collection(COLLECTIONS.trainingAssignments)
        .where("employeeId", "==", params.employeeId)
        .get(),
      adminDb
        .collection(COLLECTIONS.sopAcknowledgements)
        .where("userId", "==", params.userId)
        .get(),
    ]);
    const tniSopIds = new Set<string>();
    for (const row of tniSnap.docs) {
      const needs = (row.data().needs || []) as { sopId?: string }[];
      for (const need of needs) {
        if (need.sopId) tniSopIds.add(need.sopId);
      }
    }
    const assignedSopIds = new Set(
      assignSnap.docs
        .map((d) => (d.data() as { sopId?: string }).sopId)
        .filter((id): id is string => Boolean(id))
    );
    const acks = ackSnap.docs.map(
      (d) => d.data() as { sopId?: string; versionId?: string }
    );

    if (params.examSopId) {
      if (!tniSopIds.has(params.examSopId) && !assignedSopIds.has(params.examSopId)) {
        return {
          ok: false,
          status: 400,
          error: "This exam is not linked to your assigned SOPs",
        };
      }
      const currentVersionId = await currentSopVersionId(params.examSopId);
      if (!ackMatchesVersion(acks, params.examSopId, currentVersionId)) {
        return {
          ok: false,
          status: 400,
          error: "Read and acknowledge this SOP before taking the exam",
        };
      }
      return null;
    }

    if (tniSopIds.size === 0) return null;
    for (const sopId of tniSopIds) {
      const currentVersionId = await currentSopVersionId(sopId);
      if (!ackMatchesVersion(acks, sopId, currentVersionId)) {
        return {
          ok: false,
          status: 400,
          error: "Read and acknowledge all TNI SOPs before taking the exam",
        };
      }
    }
    return null;
  } catch (err) {
    console.error("[assertTniSopsReadServer]", err);
    return {
      ok: false,
      status: 503,
      error: "Could not verify SOP acknowledgement. Try again shortly.",
    };
  }
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
    questions: attempt.questions.map((q) => ({
      ...q,
      correctOptionIds: [],
      explanation: undefined,
    })),
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
  /** Staff preview should not require the actor's TNI acknowledgements. */
  skipTniGate?: boolean;
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

  if (exam.inductionModuleId && !input.inductionAssignmentId) {
    return {
      ok: false,
      status: 400,
      error: "Induction assignment is required for this exam",
    };
  }

  if (!input.skipTniGate && !exam.inductionModuleId && !input.inductionAssignmentId) {
    const tniBlock = await assertTniSopsReadServer({
      employeeId: input.employeeId,
      userId: input.actorId,
      examSopId: exam.sopId,
    });
    if (tniBlock) return tniBlock;
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
    if (exam.sopId && assignment.sopId && exam.sopId !== assignment.sopId) {
      return { ok: false, status: 400, error: "Exam is not linked to this SOP assignment" };
    }
    if (!["assessment_pending", "retraining"].includes(assignment.status)) {
      return {
        ok: false,
        status: 400,
        error: `Training assignment is not ready for assessment (status: ${assignment.status})`,
      };
    }
  }

  if (input.inductionAssignmentId) {
    const indSnap = await adminDb
      .collection(COLLECTIONS.inductionAssignments)
      .doc(input.inductionAssignmentId)
      .get();
    if (!indSnap.exists) {
      return { ok: false, status: 400, error: "Induction assignment not found" };
    }
    const induction = indSnap.data() as {
      employeeId?: string;
      moduleId?: string;
      status?: string;
    };
    if (induction.employeeId !== input.employeeId) {
      return { ok: false, status: 403, error: "Induction assignment does not belong to this employee" };
    }
    if (exam.inductionModuleId && induction.moduleId && exam.inductionModuleId !== induction.moduleId) {
      return { ok: false, status: 400, error: "Exam is not linked to this induction module" };
    }
    if (induction.status === "passed") {
      return {
        ok: false,
        status: 400,
        error: "Induction assignment is already completed",
      };
    }
    if (induction.status !== "assessment_pending" && induction.status !== "failed") {
      return {
        ok: false,
        status: 400,
        error: `Complete induction study before the exam (status: ${induction.status || "not_started"})`,
      };
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
  if (selected.length < exam.questionCount) {
    return {
      ok: false,
      status: 400,
      error: `Question bank has only ${selected.length} question(s); exam requires ${exam.questionCount}`,
    };
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

  await attemptRef.set(stripUndefined(attemptForPersistence(updated)));
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
      const priorAttempts = await listAttemptsForEmployee(attempt.examId, attempt.employeeId);
      const finishedBefore = priorAttempts.filter((a) => a.status !== "in_progress").length;
      const attemptsExhausted = finishedBefore + 1 >= (exam.maxAttempts || 1);
      const inductionStatus = updated.passed
        ? "passed"
        : attemptsExhausted
          ? "failed"
          : "assessment_pending";
      await adminDb
        .collection(COLLECTIONS.inductionAssignments)
        .doc(attempt.inductionAssignmentId)
        .set(
          {
            status: inductionStatus,
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

  if (updated.passed) {
    try {
      const issued = await issueCertificateForAttemptServer(updated.id, input.actorId);
      if (!issued.ok && issued.status !== 409) {
        console.error("[submitAssessmentServer] certificate issue failed:", issued.error);
      }
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
    await assignRef.set(
      {
        status: "passed",
        score: attempt.percentage,
        passed: true,
        assessmentAttemptId: attempt.id,
        updatedAt: now,
        updatedBy: actorId,
      },
      { merge: true }
    );

    const allAssignSnap = await adminDb
      .collection(COLLECTIONS.trainingAssignments)
      .where("employeeId", "==", attempt.employeeId)
      .get();
    const outstanding = allAssignSnap.docs.filter((d) => {
      if (d.id === assignmentId) return false;
      const status = (d.data() as { status?: string }).status;
      return status !== "passed" && status !== "failed" && status !== "expired";
    });

    const empRef = adminDb.collection(COLLECTIONS.employees).doc(attempt.employeeId);
    const empSnap = await empRef.get();
    const currentStage = (empSnap.data()?.lifecycleStage || "created") as LifecycleStage;
    const currentIdx = getStageIndex(currentStage);

    const targetStage: LifecycleStage = outstanding.length ? "exam" : "passed";
    const targetIdx = getStageIndex(targetStage);
    if (targetIdx > currentIdx) {
      await empRef.set(
        {
          lifecycleStage: targetStage,
          lifecycleProgress: getProgressForStage(targetStage),
          status: "active",
          updatedAt: now,
          updatedBy: actorId,
        },
        { merge: true }
      );
    }
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
