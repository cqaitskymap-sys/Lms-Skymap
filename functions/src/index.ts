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
 * When an SOP version is approved, reassign training to previously trained employees.
 * Idempotent with the client approve path: skip employees who already have the new version.
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
    const now = new Date().toISOString();
    const OPEN = new Set([
      "assigned",
      "in_progress",
      "training_scheduled",
      "retraining",
      "assessment_pending",
      "failed",
    ]);
    const COMPLETED = new Set(["passed", "training_completed"]);

    const prev = await db.collection("training_assignments").where("sopId", "==", sopId).get();

    const byEmployee = new Map<string, typeof prev.docs>();
    for (const docSnap of prev.docs) {
      const employeeId = docSnap.data().employeeId as string;
      if (!employeeId) continue;
      const list = byEmployee.get(employeeId) || [];
      list.push(docSnap);
      byEmployee.set(employeeId, list);
    }

    const ops: Array<{
      type: "update" | "set";
      ref: admin.firestore.DocumentReference;
      data: Record<string, unknown>;
    }> = [];
    const affectedEmployees: string[] = [];

    for (const [employeeId, docs] of byEmployee) {
      const alreadyOnNew = docs.some((d) => {
        const data = d.data();
        return data.sopVersionId === versionId && data.status !== "expired";
      });
      const openOld = docs.filter((d) => {
        const data = d.data();
        return OPEN.has(data.status as string) && data.sopVersionId !== versionId;
      });

      if (openOld.length) {
        for (const docSnap of openOld) {
          ops.push({
            type: "update",
            ref: docSnap.ref,
            data: {
              sopVersionId: versionId,
              isRetraining: true,
              triggeredBySopRevision: true,
              updatedAt: now,
              updatedBy: "system",
            },
          });
        }
        affectedEmployees.push(employeeId);
        continue;
      }
      if (alreadyOnNew) continue;

      const completed = docs
        .filter((d) => COMPLETED.has(d.data().status as string))
        .sort((a, b) =>
          String(b.data().updatedAt || "").localeCompare(String(a.data().updatedAt || ""))
        );
      const source = completed[0];
      if (!source) continue;
      const newId = id("ta");
      ops.push({
        type: "set",
        ref: db.collection("training_assignments").doc(newId),
        data: {
          id: newId,
          employeeId,
          sopId,
          sopVersionId: versionId,
          trainerId: source.data().trainerId || null,
          assignedBy: "system",
          departmentId: source.data().departmentId,
          status: "assigned",
          attemptCount: 0,
          isRetraining: true,
          previousAssignmentId: source.id,
          triggeredBySopRevision: true,
          createdAt: now,
          updatedAt: now,
          createdBy: "system",
        },
      });
      affectedEmployees.push(employeeId);
    }

    let batch = db.batch();
    let writes = 0;
    for (const op of ops) {
      if (op.type === "update") batch.update(op.ref, op.data);
      else batch.set(op.ref, op.data);
      writes++;
      if (writes >= 400) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }
    if (writes > 0) {
      await batch.commit();
    }

    const uniqueEmployees = Array.from(new Set(affectedEmployees));
    for (const empId of uniqueEmployees) {
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
      description: `Auto-reassigned training to ${uniqueEmployees.length} employees after SOP revision ${versionId}`,
      after: { count: uniqueEmployees.length, versionId },
    });
  }
);

/**
 * Evaluate assessment attempt on submit — authoritative server-side scoring.
 * Prefer Next.js /api/assessments/submit which uses the shared engine + Admin SDK.
 * This callable is kept for compatibility; it rehydrates answer keys from the bank.
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
  if (attempt.status !== "in_progress" && attempt.status !== "submitted") {
    throw new HttpsError("failed-precondition", "Attempt already submitted");
  }

  const employeeId = attempt.employeeId as string;
  if (
    employeeId !== request.auth.uid &&
    attempt.createdBy !== request.auth.uid
  ) {
    // Allow if caller profile employeeId matches — best-effort without users join
    const userSnap = await db.collection("users").doc(request.auth.uid).get();
    const profileEmp = userSnap.data()?.employeeId as string | undefined;
    if (profileEmp !== employeeId) {
      throw new HttpsError("permission-denied", "Not your attempt");
    }
  }

  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(attemptRef);
    if (!snap.exists) return "missing" as const;
    const current = snap.data()!;
    if (current.status !== "in_progress") return "taken" as const;
    tx.update(attemptRef, {
      status: "submitted",
      updatedAt: new Date().toISOString(),
    });
    return "ok" as const;
  });
  if (claimed === "missing") throw new HttpsError("not-found", "Attempt not found");
  if (claimed === "taken") {
    throw new HttpsError("failed-precondition", "Attempt already submitted");
  }

  const examSnap = await db.collection("exams").doc(attempt.examId).get();
  if (!examSnap.exists) {
    await attemptRef.update({
      status: "in_progress",
      updatedAt: new Date().toISOString(),
    });
    throw new HttpsError("not-found", "Exam not found");
  }
  const exam = examSnap.data()!;
  const now = new Date();
  const expired = now > new Date(attempt.expiresAt);

  // Rehydrate keys from question bank
  const bankIds = [exam.bankId as string, ...((exam.bankIds as string[]) || [])];
  const keyById = new Map<string, string[]>();
  for (const bankId of bankIds) {
    const qSnap = await db
      .collection("questions")
      .where("bankId", "==", bankId)
      .where("isActive", "==", true)
      .get();
    for (const d of qSnap.docs) {
      const q = d.data();
      const correct = ((q.options as Array<{ id: string; isCorrect?: boolean }>) || [])
        .filter((o) => o.isCorrect)
        .map((o) => o.id);
      keyById.set(d.id, correct);
    }
  }

  let totalMarks = 0;
  let earnedMarks = 0;
  let negativeApplied = 0;
  const negEnabled = !!exam.negativeMarkingEnabled;

  const questions = (
    attempt.questions as Array<{
      questionId: string;
      marks: number;
      negativeMarks?: number;
      correctOptionIds: string[];
      selectedOptionIds: string[];
    }>
  ).map((q) => {
    const selected = answers[q.questionId] || q.selectedOptionIds || [];
    const correctIds = keyById.get(q.questionId) || q.correctOptionIds || [];
    const correct = new Set(correctIds);
    const sel = new Set(selected);
    const isCorrect =
      correct.size === sel.size && [...correct].every((x) => sel.has(x));
    totalMarks += q.marks;
    let earned = 0;
    if ((selected.length || 0) > 0) {
      if (isCorrect) earned = q.marks;
      else if (negEnabled) {
        const penalty = q.negativeMarks || exam.defaultNegativeMarks || 0;
        earned = -penalty;
        negativeApplied += penalty;
      }
    }
    earnedMarks += earned;
    return {
      ...q,
      selectedOptionIds: selected,
      correctOptionIds: [],
      explanation: null,
      earnedMarks: earned,
      isCorrect,
      isAnswered: selected.length > 0,
    };
  });

  const percentage =
    totalMarks === 0 ? 0 : Math.round((earnedMarks / totalMarks) * 10000) / 100;
  const passed = !expired && percentage >= (exam.passPercentage as number);
  const certThreshold =
    (exam.certificatePassPercentage as number) ?? (exam.passPercentage as number);
  const certificateEligible = !expired && percentage >= certThreshold;

  await attemptRef.update({
    questions,
    answersDraft: answers,
    status: expired ? "expired" : passed ? "passed" : "failed",
    submittedAt: now.toISOString(),
    score: earnedMarks,
    maxScore: totalMarks,
    percentage,
    passed,
    certificateEligible,
    negativeMarksApplied: negativeApplied,
    updatedAt: now.toISOString(),
  });

  if (attempt.assignmentId && passed) {
    const assignRef = db.collection("training_assignments").doc(attempt.assignmentId);
    await assignRef.update({
      status: "passed",
      score: percentage,
      passed: true,
      assessmentAttemptId: attemptId,
      updatedAt: now.toISOString(),
    });
  } else if (attempt.assignmentId && !passed) {
    const assignRef = db.collection("training_assignments").doc(attempt.assignmentId);
    const assignSnap = await assignRef.get();
    const prev = assignSnap.data() || {};
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
  }

  return { passed, percentage, score: earnedMarks, certificateEligible, expired };
});

/**
 * Public certificate verification (no auth).
 */
export const verifyCertificate = onCall(async (request) => {
  const { certificateNumber } = request.data as { certificateNumber: string };
  if (!certificateNumber) throw new HttpsError("invalid-argument", "certificateNumber required");

  const number = String(certificateNumber).trim().toUpperCase();
  const snap = await db
    .collection("certificates")
    .where("certificateNumber", "==", number)
    .limit(1)
    .get();

  if (snap.empty) return { valid: false };
  const cert = snap.docs[0].data();
  if (cert.isRevoked) return { valid: false, reason: "revoked" };

  return {
    valid: true,
    certificateNumber: cert.certificateNumber,
    employeeName: cert.employeeName,
    percentage: cert.percentage,
    issuedAt: cert.issuedAt,
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
        `/dashboard/training`
      );
    }
  }

  const ojtSnap = await db
    .collection("ojt_assignments")
    .where("status", "in", [
      "selected",
      "assigned",
      "scheduled",
      "in_progress",
      "trainer_completed",
      "employee_acknowledged",
      "verification_pending",
      "qa_pending",
      "rescheduled",
    ])
    .get();

  const today = new Date();
  for (const docSnap of ojtSnap.docs) {
    const a = docSnap.data();
    const year = Number(a.year);
    const month = Number(a.plannedExecutionMonth);
    if (!year || !month) continue;
    const deadline = new Date(year, month, 0, 23, 59, 59, 999);
    if (today.getTime() <= deadline.getTime()) continue;
    const emp = await db.collection("employees").doc(a.employeeId).get();
    const userId = emp.data()?.userId as string | undefined;
    if (userId) {
      await notify(
        userId,
        "reminder",
        "Overdue OJT",
        `On Job Training is overdue: ${a.trainingTopic || "assigned topic"}.`,
        `/dashboard/ojt/assignments/${docSnap.id}`
      );
    }
    if (a.trainerId) {
      await notify(
        a.trainerId as string,
        "reminder",
        "Overdue OJT — trainer action",
        `${a.employeeName || "Employee"} — ${a.trainingTopic || "OJT"} is overdue.`,
        `/dashboard/ojt/assignments/${docSnap.id}`
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

  // Ensure lifecycle fields exist for API-created employees
  if (!data.lifecycleStage) {
    await event.data?.ref.set(
      {
        lifecycleStage: "hr_verification",
        lifecycleProgress: 8,
        status: data.status === "draft" ? "pending_verification" : data.status,
      },
      { merge: true }
    );
  }

  if (data.userId) {
    await notify(
      data.userId,
      "system",
      "Welcome to PharmaLMS",
      "Your employee profile has been created. Complete induction when assigned.",
      `/dashboard/employees/${event.params.employeeId}`
    );
  }
});

/**
 * When training assignment status changes, mirror employee lifecycle stage.
 */
export const onTrainingAssignmentUpdated = onDocumentUpdated(
  "training_assignments/{assignmentId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;

    const employeeId = after.employeeId as string;
    const empRef = db.collection("employees").doc(employeeId);
    const empSnap = await empRef.get();
    if (!empSnap.exists) return;

    const now = new Date().toISOString();
    const status = after.status as string;
    let patch: Record<string, unknown> | null = null;

    if (status === "assigned" && after.trainerId) {
      patch = {
        lifecycleStage: "sop_assigned",
        lifecycleProgress: 68,
        currentTrainerId: after.trainerId,
        status: "active",
        updatedAt: now,
      };
    } else if (["in_progress", "training_scheduled", "training_completed"].includes(status)) {
      patch = { lifecycleStage: "training", lifecycleProgress: 76, status: "active", updatedAt: now };
    } else if (status === "assessment_pending") {
      patch = { lifecycleStage: "exam", lifecycleProgress: 84, status: "active", updatedAt: now };
    } else if (status === "passed") {
      patch = {
        lifecycleStage: after.certificateId ? "certified" : "passed",
        lifecycleProgress: after.certificateId ? 96 : 90,
        status: "active",
        updatedAt: now,
      };
    }

    if (!patch) return;
    await empRef.set(patch, { merge: true });

    const levId = id("lev");
    await db.collection("lifecycle_events").doc(levId).set({
      id: levId,
      employeeId,
      stage: patch.lifecycleStage,
      title: String(patch.lifecycleStage),
      description: `Auto-synced from training assignment (${status})`,
      status: "completed",
      actorId: "system",
      actorName: "Cloud Function",
      actorRole: "super_admin",
      completedAt: now,
      createdAt: now,
      metadata: { assignmentId: event.params.assignmentId },
    });

    const userId = empSnap.data()?.userId;
    if (userId) {
      await notify(
        userId,
        "assignment",
        "Training progress updated",
        `Your training status is now: ${status.replace(/_/g, " ")}`,
        `/dashboard/employees/${employeeId}`
      );
    }
  }
);

/**
 * When certificate is issued, advance employee to certified (not auto-qualified).
 * Full qualification requires all required SOP trainings to be complete.
 */
export const onCertificateCreated = onDocumentCreated(
  "certificates/{certificateId}",
  async (event) => {
    const data = event.data?.data();
    if (!data?.employeeId || data.isRevoked) return;
    const now = new Date().toISOString();
    const empRef = db.collection("employees").doc(data.employeeId);
    const empSnap = await empRef.get();
    const current = empSnap.data()?.lifecycleStage as string | undefined;
    // Don't regress past certified/qualified
    if (current === "qualified") return;

    await empRef.set(
      {
        lifecycleStage: "certified",
        lifecycleProgress: 96,
        status: "active",
        updatedAt: now,
      },
      { merge: true }
    );

    const levId = id("lev");
    await db.collection("lifecycle_events").doc(levId).set({
      id: levId,
      employeeId: data.employeeId,
      stage: "certified",
      title: "Certificate Issued",
      description: `Certificate ${data.certificateNumber} issued after all assigned exams`,
      status: "completed",
      actorId: "system",
      actorName: "Cloud Function",
      completedAt: now,
      createdAt: now,
      metadata: { certificateId: event.params.certificateId },
    });

    const emp = await empRef.get();
    if (emp.data()?.userId) {
      await notify(
        emp.data()!.userId,
        "certificate",
        "Certificate issued",
        "Your training certificate is ready. View it under Certificates.",
        "/dashboard/certificates"
      );
    }
  }
);
