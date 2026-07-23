import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "asia-south1", maxInstances: 20 });

function id(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

async function writeAudit(params: {
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  description: string;
  after?: Record<string, unknown>;
}) {
  const auditId = id("audit");
  await db.collection("audit_logs").doc(auditId).set({
    id: auditId,
    timestamp: new Date().toISOString(),
    ...params,
  });
}

async function notify(userId: string, type: string, title: string, message: string, link?: string) {
  const notifId = id("notif");
  await db.collection("notifications").doc(notifId).set({
    id: notifId,
    userId,
    type,
    title,
    message,
    link,
    isRead: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "system",
  });
}

/**
 * When an SOP version is approved, reassign training to all previously trained employees.
 */
export const onSopVersionApproved = onDocumentUpdated(
  "sop_versions/{versionId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === "approved" || after.status !== "approved") return;

    const sopId = after.sopId as string;
    const versionId = event.params.versionId;

    const prev = await db
      .collection("training_assignments")
      .where("sopId", "==", sopId)
      .where("status", "in", ["passed", "training_completed", "assessment_pending"])
      .get();

    const batch = db.batch();
    const now = new Date().toISOString();
    let count = 0;

    for (const doc of prev.docs) {
      const prevData = doc.data();
      const newId = id("ta");
      const ref = db.collection("training_assignments").doc(newId);
      batch.set(ref, {
        id: newId,
        employeeId: prevData.employeeId,
        sopId,
        sopVersionId: versionId,
        trainerId: prevData.trainerId || null,
        assignedBy: "system",
        departmentId: prevData.departmentId,
        status: "assigned",
        attemptCount: 0,
        isRetraining: true,
        previousAssignmentId: doc.id,
        triggeredBySopRevision: true,
        createdAt: now,
        updatedAt: now,
        createdBy: "system",
      });
      count++;
    }

    await batch.commit();

    // Notify employees (best-effort sequential for demo scale)
    for (const doc of prev.docs) {
      const empId = doc.data().employeeId as string;
      const empSnap = await db.collection("employees").doc(empId).get();
      const userId = empSnap.data()?.userId as string | undefined;
      if (userId) {
        await notify(
          userId,
          "sop_revision",
          "SOP Revised — Retraining Required",
          "An SOP you were trained on has been revised. Please complete the updated training.",
          "/dashboard/training"
        );
      }
    }

    await writeAudit({
      actorId: "system",
      actorEmail: "system@pharma-lms",
      actorRole: "super_admin",
      action: "reassign",
      resourceType: "sop",
      resourceId: sopId,
      description: `Auto-reassigned training to ${count} employees after SOP revision ${versionId}`,
      after: { count, versionId },
    });
  }
);

/**
 * Evaluate assessment attempt on submit — authoritative server-side scoring.
 */
export const submitAssessment = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required");

  const { attemptId, answers } = request.data as {
    attemptId: string;
    answers: Record<string, string[]>;
  };

  if (!attemptId || !answers) {
    throw new HttpsError("invalid-argument", "attemptId and answers required");
  }

  const attemptRef = db.collection("assessment_attempts").doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw new HttpsError("not-found", "Attempt not found");

  const attempt = attemptSnap.data()!;
  if (attempt.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Attempt already submitted");
  }

  const examSnap = await db.collection("exams").doc(attempt.examId).get();
  const exam = examSnap.data()!;
  const now = new Date();
  const expired = now > new Date(attempt.expiresAt);

  let totalMarks = 0;
  let earnedMarks = 0;

  const questions = (attempt.questions as Array<{
    questionId: string;
    marks: number;
    correctOptionIds: string[];
    selectedOptionIds: string[];
  }>).map((q) => {
    const selected = answers[q.questionId] || q.selectedOptionIds || [];
    const correct = new Set(q.correctOptionIds);
    const sel = new Set(selected);
    const isCorrect =
      correct.size === sel.size && [...correct].every((x) => sel.has(x));
    totalMarks += q.marks;
    const earned = isCorrect ? q.marks : 0;
    earnedMarks += earned;
    return { ...q, selectedOptionIds: selected, earnedMarks: earned, isCorrect };
  });

  const percentage =
    totalMarks === 0 ? 0 : Math.round((earnedMarks / totalMarks) * 10000) / 100;
  const passed = !expired && percentage >= (exam.passPercentage as number);

  await attemptRef.update({
    questions,
    status: passed ? "passed" : "failed",
    submittedAt: now.toISOString(),
    score: earnedMarks,
    percentage,
    passed,
    updatedAt: now.toISOString(),
  });

  if (attempt.assignmentId) {
    const assignRef = db.collection("training_assignments").doc(attempt.assignmentId);
    if (passed) {
      const certId = id("cert");
      const certNumber = `CERT-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const assignSnap = await assignRef.get();
      const assignment = assignSnap.data()!;
      const hash = crypto
        .createHash("sha256")
        .update(`${certNumber}|${attempt.employeeId}|${assignment.sopId}|${percentage}`)
        .digest("hex");

      await db.collection("certificates").doc(certId).set({
        id: certId,
        certificateNumber: certNumber,
        employeeId: attempt.employeeId,
        trainingAssignmentId: attempt.assignmentId,
        sopId: assignment.sopId,
        sopVersionId: assignment.sopVersionId,
        examId: attempt.examId,
        attemptId,
        title: "Certificate of Training",
        issuedAt: now.toISOString(),
        score: earnedMarks,
        percentage,
        qrCodeData: `${process.env.APP_URL || ""}/verify/${certNumber}`,
        verificationHash: hash,
        isRevoked: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: "system",
      });

      await assignRef.update({
        status: "passed",
        score: percentage,
        passed: true,
        certificateId: certId,
        assessmentAttemptId: attemptId,
        updatedAt: now.toISOString(),
      });

      const emp = await db.collection("employees").doc(attempt.employeeId).get();
      if (emp.data()?.userId) {
        await notify(
          emp.data()!.userId,
          "certificate",
          "Certificate Issued",
          `Certificate ${certNumber} has been issued.`,
          "/dashboard/certificates"
        );
      }
    } else {
      // Auto schedule retraining
      const assignSnap = await assignRef.get();
      const prev = assignSnap.data()!;
      await assignRef.update({
        status: "failed",
        score: percentage,
        passed: false,
        assessmentAttemptId: attemptId,
        updatedAt: now.toISOString(),
      });

      const retrainId = id("ta");
      const due = new Date(now);
      due.setDate(due.getDate() + 7);
      await db.collection("training_assignments").doc(retrainId).set({
        id: retrainId,
        employeeId: prev.employeeId,
        sopId: prev.sopId,
        sopVersionId: prev.sopVersionId,
        trainerId: prev.trainerId || null,
        assignedBy: "system",
        departmentId: prev.departmentId,
        status: "retraining",
        dueDate: due.toISOString(),
        attemptCount: (prev.attemptCount || 0) + 1,
        isRetraining: true,
        previousAssignmentId: attempt.assignmentId,
        triggeredBySopRevision: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: "system",
      });

      const emp = await db.collection("employees").doc(attempt.employeeId).get();
      if (emp.data()?.userId) {
        await notify(
          emp.data()!.userId,
          "retraining",
          "Retraining Scheduled",
          "You did not pass the assessment. Retraining has been scheduled.",
          "/dashboard/training"
        );
      }
    }
  }

  return { passed, percentage, score: earnedMarks };
});

/**
 * Public certificate verification (no auth).
 */
export const verifyCertificate = onCall(async (request) => {
  const { certificateNumber } = request.data as { certificateNumber: string };
  if (!certificateNumber) throw new HttpsError("invalid-argument", "certificateNumber required");

  const snap = await db
    .collection("certificates")
    .where("certificateNumber", "==", certificateNumber)
    .limit(1)
    .get();

  if (snap.empty) return { valid: false };
  const cert = snap.docs[0].data();
  if (cert.isRevoked) return { valid: false, reason: "revoked" };

  return {
    valid: true,
    certificateNumber: cert.certificateNumber,
    employeeId: cert.employeeId,
    sopId: cert.sopId,
    percentage: cert.percentage,
    issuedAt: cert.issuedAt,
    verificationHash: cert.verificationHash,
  };
});

/**
 * Daily reminder for overdue trainings.
 */
export const overdueTrainingReminders = onSchedule("every day 09:00", async () => {
  const now = new Date().toISOString();
  const snap = await db
    .collection("training_assignments")
    .where("status", "in", ["assigned", "in_progress", "retraining", "assessment_pending"])
    .get();

  for (const doc of snap.docs) {
    const a = doc.data();
    if (!a.dueDate || a.dueDate > now) continue;
    const emp = await db.collection("employees").doc(a.employeeId).get();
    const userId = emp.data()?.userId;
    if (userId) {
      await notify(
        userId,
        "reminder",
        "Overdue Training",
        "You have an overdue training assignment. Please complete it promptly.",
        `/dashboard/training/${doc.id}`
      );
    }
  }
});

/**
 * Log employee creation for audit.
 */
export const onEmployeeCreated = onDocumentCreated("employees/{employeeId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await writeAudit({
    actorId: data.createdBy || "system",
    actorEmail: "hr@system",
    actorRole: "hr",
    action: "create",
    resourceType: "employee",
    resourceId: event.params.employeeId,
    description: `Employee ${data.employeeCode} created`,
    after: { employeeCode: data.employeeCode, email: data.email },
  });
});
