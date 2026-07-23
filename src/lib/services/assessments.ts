import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import type {
  Exam,
  Question,
  AssessmentAttempt,
  AttemptQuestion,
  TrainingAssignment,
  Certificate,
} from "@/types";
import { generateId, nowISO, addDays } from "@/lib/services/helpers";
import { shuffleArray, calculatePercentage, generateCertificateNumber } from "@/lib/utils";

export async function startAssessment(params: {
  examId: string;
  employeeId: string;
  assignmentId?: string;
  inductionAssignmentId?: string;
}): Promise<AssessmentAttempt> {
  const examSnap = await getDoc(doc(db, COLLECTIONS.exams, params.examId));
  if (!examSnap.exists()) throw new Error("Exam not found");
  const exam = examSnap.data() as Exam;

  const qSnap = await getDocs(
    query(
      collection(db, COLLECTIONS.questions),
      where("bankId", "==", exam.bankId),
      where("isActive", "==", true)
    )
  );
  let questions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);
  if (exam.shuffleQuestions) questions = shuffleArray(questions);
  questions = questions.slice(0, exam.questionCount);

  const attemptQuestions: AttemptQuestion[] = questions.map((q) => {
    let options = q.options.map((o) => ({ id: o.id, text: o.text }));
    if (exam.shuffleOptions) options = shuffleArray(options);
    return {
      questionId: q.id,
      text: q.text,
      type: q.type,
      options,
      selectedOptionIds: [],
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      marks: q.marks,
      earnedMarks: 0,
      isCorrect: false,
    };
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);
  const id = generateId("att");

  const attempt: AssessmentAttempt = {
    id,
    examId: params.examId,
    employeeId: params.employeeId,
    assignmentId: params.assignmentId,
    inductionAssignmentId: params.inductionAssignmentId,
    status: "in_progress",
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    questions: attemptQuestions,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdBy: params.employeeId,
  };

  await setDoc(doc(db, COLLECTIONS.assessmentAttempts, id), attempt);
  return attempt;
}

export async function submitAssessment(
  attemptId: string,
  answers: Record<string, string[]>,
  actorId: string
): Promise<AssessmentAttempt> {
  const snap = await getDoc(doc(db, COLLECTIONS.assessmentAttempts, attemptId));
  if (!snap.exists()) throw new Error("Attempt not found");
  const attempt = snap.data() as AssessmentAttempt;

  if (attempt.status !== "in_progress") throw new Error("Attempt already submitted");

  const now = new Date();
  const expired = now > new Date(attempt.expiresAt);

  const examSnap = await getDoc(doc(db, COLLECTIONS.exams, attempt.examId));
  const exam = examSnap.data() as Exam;

  let totalMarks = 0;
  let earnedMarks = 0;

  const evaluated = attempt.questions.map((q) => {
    const selected = answers[q.questionId] || q.selectedOptionIds;
    const correctSet = new Set(q.correctOptionIds);
    const selectedSet = new Set(selected);
    const isCorrect =
      correctSet.size === selectedSet.size &&
      [...correctSet].every((id) => selectedSet.has(id));
    const earned = isCorrect ? q.marks : 0;
    totalMarks += q.marks;
    earnedMarks += earned;
    return {
      ...q,
      selectedOptionIds: selected,
      earnedMarks: earned,
      isCorrect,
    };
  });

  const percentage = calculatePercentage(earnedMarks, totalMarks);
  const passed = !expired && percentage >= exam.passPercentage;

  const updated: AssessmentAttempt = {
    ...attempt,
    questions: evaluated,
    status: passed ? "passed" : "failed",
    submittedAt: now.toISOString(),
    score: earnedMarks,
    percentage,
    passed,
    timeSpentSeconds: Math.round(
      (now.getTime() - new Date(attempt.startedAt).getTime()) / 1000
    ),
    updatedAt: now.toISOString(),
    updatedBy: actorId,
  };

  await setDoc(doc(db, COLLECTIONS.assessmentAttempts, attemptId), updated);

  // Update related assignment
  if (attempt.assignmentId) {
    await handleTrainingAssessmentResult(attempt.assignmentId, updated, exam, actorId);
  }

  if (attempt.inductionAssignmentId) {
    await updateDoc(doc(db, COLLECTIONS.inductionAssignments, attempt.inductionAssignmentId), {
      status: passed ? "passed" : "failed",
      score: percentage,
      passed,
      assessmentAttemptId: attemptId,
      completedAt: passed ? now.toISOString() : undefined,
      updatedAt: now.toISOString(),
      updatedBy: actorId,
    });
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
  } else {
    // Auto-schedule retraining
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
  const assignSnap = await getDoc(
    doc(db, COLLECTIONS.trainingAssignments, params.trainingAssignmentId)
  );
  const assignment = assignSnap.data() as TrainingAssignment;
  const sopSnap = await getDoc(doc(db, COLLECTIONS.sops, assignment.sopId));
  const sop = sopSnap.data();

  const id = generateId("cert");
  const certNumber = generateCertificateNumber();
  const now = nowISO();
  const verificationHash = await hashString(
    `${certNumber}|${params.employeeId}|${assignment.sopId}|${params.percentage}|${now}`
  );

  const certificate: Certificate = {
    id,
    certificateNumber: certNumber,
    employeeId: params.employeeId,
    trainingAssignmentId: params.trainingAssignmentId,
    sopId: assignment.sopId,
    sopVersionId: assignment.sopVersionId,
    examId: params.examId,
    attemptId: params.attemptId,
    title: `Certificate of Training — ${sop?.title || "SOP"}`,
    issuedAt: now,
    score: params.score,
    percentage: params.percentage,
    trainerId: params.trainerId || assignment.trainerId,
    qrCodeData: `${process.env.NEXT_PUBLIC_APP_URL || ""}/verify/${certNumber}`,
    verificationHash,
    isRevoked: false,
    createdAt: now,
    updatedAt: now,
    createdBy: params.actorId,
  };

  await setDoc(doc(db, COLLECTIONS.certificates, id), certificate);
  return certificate;
}

async function hashString(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback simple hash
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

export async function getAttempt(id: string): Promise<AssessmentAttempt | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.assessmentAttempts, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AssessmentAttempt;
}
