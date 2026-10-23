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

/** End of a calendar day in Asia/Kolkata (UTC+5:30, no daylight saving). */
function istDayEndMs(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day, 18, 29, 59, 999);
}

/** Calendar dates (and noon/midnight UTC copies of them) are due at the end of that day in India. */
function isPastDue(dueDate: string, nowMs: number): boolean {
  const calendar =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(?:00|12):00:00(?:\.\d+)?Z)?$/.exec(dueDate.trim());
  if (calendar) {
    return (
      nowMs >
      istDayEndMs(Number(calendar[1]), Number(calendar[2]), Number(calendar[3]))
    );
  }
  const parsed = new Date(dueDate).getTime();
  return Number.isFinite(parsed) && nowMs > parsed;
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

async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
  notifId?: string
) {
  const noticeId = notifId || id("notif");
  const ref = db.collection("notifications").doc(noticeId);
  if (notifId && (await ref.get()).exists) return;
  await ref.set({
    id: noticeId,
    userId,
    type,
    title,
    message,
    ...(link ? { link } : {}),
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
      "training_completed",
      "failed",
    ]);
    const COMPLETED = new Set(["passed"]);

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
        const primary = [...openOld].sort((a, b) =>
          String(b.data().updatedAt || "").localeCompare(String(a.data().updatedAt || ""))
        )[0];
        for (const docSnap of openOld) {
          ops.push({
            type: "update",
            ref: docSnap.ref,
            data: {
              status: "expired",
              updatedAt: now,
              updatedBy: "system",
            },
          });
        }
        if (!alreadyOnNew) {
          const newId = `ta_${employeeId}_${versionId}`;
          ops.push({
            type: "set",
            ref: db.collection("training_assignments").doc(newId),
            data: {
              id: newId,
              employeeId,
              sopId,
              sopVersionId: versionId,
              trainerId: primary.data().trainerId || null,
              assignedBy: "system",
              departmentId: primary.data().departmentId ?? null,
              status: "retraining",
              attemptCount: 0,
              isRetraining: true,
              previousAssignmentId: primary.id,
              triggeredBySopRevision: true,
              createdAt: now,
              updatedAt: now,
              createdBy: "system",
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
      const newId = `ta_${employeeId}_${versionId}`;
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
          departmentId: source.data().departmentId ?? null,
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

    const updates = ops.filter((op) => op.type === "update");
    const creates = ops.filter((op) => op.type === "set");

    let batch = db.batch();
    let writes = 0;
    for (const op of updates) {
      batch.update(op.ref, op.data);
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

    for (const op of creates) {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(op.ref);
        if (snap.exists) return;
        tx.set(op.ref, op.data);
      });
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
          "/dashboard/training",
          `notif_soprev_${versionId}_${userId}`
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

  if (!attemptId) {
    throw new HttpsError("invalid-argument", "attemptId required");
  }

  const attemptRef = db.collection("assessment_attempts").doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw new HttpsError("not-found", "Attempt not found");

  const attempt = attemptSnap.data()!;
  const draftAnswers =
    attempt.answersDraft && typeof attempt.answersDraft === "object"
      ? (attempt.answersDraft as Record<string, string[]>)
      : {};
  const submittedAnswers =
    answers && typeof answers === "object" ? answers : {};
  if (!answers && Object.keys(draftAnswers).length === 0) {
    throw new HttpsError("invalid-argument", "answers required");
  }
  const mergedAnswers = { ...draftAnswers, ...submittedAnswers };
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
    const incompleteClaim =
      current.status === "submitted" && current.submittedAt == null && current.score == null;
    if (current.status !== "in_progress" && !incompleteClaim) return "taken" as const;
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

  let finalized = false;
  try {
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
  const bankIds = [exam.bankId, ...((exam.bankIds as unknown[]) || [])].filter(
    (bankId): bankId is string => typeof bankId === "string" && bankId.trim().length > 0
  );
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

  const attemptQuestions = attempt.questions as
    | Array<{
        questionId: string;
        marks: number;
        negativeMarks?: number;
        correctOptionIds: string[];
        selectedOptionIds: string[];
      }>
    | undefined;
  if (!Array.isArray(attemptQuestions)) {
    await attemptRef.update({
      status: "in_progress",
      updatedAt: new Date().toISOString(),
    });
    throw new HttpsError("failed-precondition", "Attempt has no questions");
  }

  const missingIds = [
    ...new Set(
      attemptQuestions
        .map((q) => q.questionId)
        .filter((id) => typeof id === "string" && id.length > 0 && !keyById.has(id))
    ),
  ];
  for (let offset = 0; offset < missingIds.length; offset += 10) {
    const chunk = missingIds.slice(offset, offset + 10);
    const extra = await db
      .collection("questions")
      .where(admin.firestore.FieldPath.documentId(), "in", chunk)
      .get();
    for (const d of extra.docs) {
      const q = d.data();
      const correct = ((q.options as Array<{ id: string; isCorrect?: boolean }>) || [])
        .filter((o) => o.isCorrect)
        .map((o) => o.id);
      keyById.set(d.id, correct);
    }
  }

  const questions = attemptQuestions.map((q) => {
    const selected = mergedAnswers[q.questionId] || q.selectedOptionIds || [];
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
        const penalty = q.negativeMarks ?? exam.defaultNegativeMarks ?? 0;
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

  const rawPercentage = totalMarks === 0 ? 0 : (earnedMarks / totalMarks) * 100;
  const percentage = Math.round(Math.max(0, rawPercentage) * 100) / 100;
  const passed = !expired && percentage >= (exam.passPercentage as number);
  const certThreshold =
    (exam.certificatePassPercentage as number) ?? (exam.passPercentage as number);
  const certificateEligible = passed && percentage >= certThreshold;

  await attemptRef.update({
    questions,
    answersDraft: mergedAnswers,
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
  finalized = true;

  if (attempt.assignmentId && passed) {
    const assignRef = db.collection("training_assignments").doc(attempt.assignmentId);
    const assignSnap = await assignRef.get();
    const current = assignSnap.data() || {};
    const versionMismatch =
      typeof attempt.sopVersionId === "string" &&
      typeof current.sopVersionId === "string" &&
      attempt.sopVersionId !== current.sopVersionId;
    const revisedAfterStart =
      versionMismatch ||
      (current.triggeredBySopRevision === true &&
        typeof current.updatedAt === "string" &&
        typeof attempt.startedAt === "string" &&
        current.updatedAt > attempt.startedAt);
    const ready =
      current.status === "assessment_pending" || current.status === "retraining";
    if (!revisedAfterStart && ready) {
      await assignRef.update({
        status: "passed",
        score: percentage,
        passed: true,
        assessmentAttemptId: attemptId,
        updatedAt: now.toISOString(),
      });
    }
  } else if (attempt.assignmentId && !passed) {
    const assignRef = db.collection("training_assignments").doc(attempt.assignmentId);
    const assignSnap = await assignRef.get();
    const prev = assignSnap.data() || {};
    const maxAttempts = Number(exam.maxAttempts) > 0 ? Number(exam.maxAttempts) : 1;
    const priorSnap = await db
      .collection("assessment_attempts")
      .where("examId", "==", attempt.examId)
      .where("employeeId", "==", employeeId)
      .get();
    const finishedInCycle = priorSnap.docs.filter((d) => {
      const row = d.data();
      return (
        row.assignmentId === attempt.assignmentId &&
        (row.status === "passed" || row.status === "failed" || row.status === "expired")
      );
    }).length;
    if (finishedInCycle < maxAttempts) {
      await assignRef.update({
        status: prev.status === "retraining" ? "retraining" : "assessment_pending",
        score: percentage,
        passed: false,
        assessmentAttemptId: attemptId,
        updatedAt: now.toISOString(),
      });
    } else {
      await assignRef.update({
        status: "failed",
        score: percentage,
        passed: false,
        assessmentAttemptId: attemptId,
        updatedAt: now.toISOString(),
      });
      const open = new Set([
        "assigned",
        "in_progress",
        "training_scheduled",
        "training_completed",
        "assessment_pending",
        "retraining",
      ]);
      const sibling = prev.employeeId
        ? await db.collection("training_assignments").where("employeeId", "==", prev.employeeId).get()
        : null;
      const alreadyOpen = sibling?.docs.some((d) => {
        if (d.id === attempt.assignmentId) return false;
        const row = d.data();
        return row.sopId === prev.sopId && open.has(String(row.status || ""));
      });
      if (!alreadyOpen && prev.employeeId && prev.sopId) {
        const retrainId = id("ta");
        const due = new Date(now);
        due.setDate(due.getDate() + 7);
        await db.collection("training_assignments").doc(retrainId).set({
          id: retrainId,
          employeeId: prev.employeeId,
          sopId: prev.sopId,
          sopVersionId: prev.sopVersionId || null,
          trainerId: prev.trainerId || null,
          assignedBy: "system",
          departmentId: prev.departmentId ?? null,
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
    }
  }

  return { passed, percentage, score: earnedMarks, certificateEligible, expired };
  } catch (err) {
    if (!finalized) {
      await attemptRef
        .update({
          status: "in_progress",
          updatedAt: new Date().toISOString(),
        })
        .catch(() => undefined);
    }
    throw err;
  }
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
  const snap = await db
    .collection("training_assignments")
    .where("status", "in", ["assigned", "in_progress", "retraining", "assessment_pending"])
    .get();

  for (const doc of snap.docs) {
    const a = doc.data();
    if (!a.dueDate || !isPastDue(String(a.dueDate), Date.now())) continue;
    const emp = await db.collection("employees").doc(a.employeeId).get();
    const userId = emp.data()?.userId;
    if (userId) {
      const day = new Date().toISOString().slice(0, 10);
      await notify(
        userId,
        "reminder",
        "Overdue Training",
        "You have an overdue training assignment. Please complete it promptly.",
        `/dashboard/training`,
        `notif_overdue_training_${doc.id}_${day}`
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

  const settingsSnap = await db.collection("ojt_settings").doc("global").get();
  const graceRaw = Number(settingsSnap.data()?.overdueGraceDays ?? 0);
  const graceDays = Number.isFinite(graceRaw) && graceRaw > 0 ? Math.min(Math.floor(graceRaw), 60) : 0;

  const today = new Date();
  for (const docSnap of ojtSnap.docs) {
    const a = docSnap.data();
    const year = Number(a.year);
    const listed = Array.isArray(a.plannedExecutionMonths)
      ? a.plannedExecutionMonths
          .map((month: unknown) => Number(month))
          .filter((month: number) => month >= 1 && month <= 12)
      : [];
    const month = listed.length ? Math.max(...listed) : Number(a.plannedExecutionMonth);
    if (!year || !month) continue;
    const lastUtc = new Date(Date.UTC(year, month, 0));
    const deadlineMs =
      istDayEndMs(lastUtc.getUTCFullYear(), lastUtc.getUTCMonth() + 1, lastUtc.getUTCDate()) +
      graceDays * 86400000;
    if (today.getTime() <= deadlineMs) continue;
    const emp = await db.collection("employees").doc(a.employeeId).get();
    const userId = emp.data()?.userId as string | undefined;
    const day = new Date().toISOString().slice(0, 10);
    if (userId) {
      await notify(
        userId,
        "reminder",
        "Overdue OJT",
        `On Job Training is overdue: ${a.trainingTopic || "assigned topic"}.`,
        `/dashboard/ojt/assignments/${docSnap.id}`,
        `notif_overdue_ojt_${docSnap.id}_${userId}_${day}`
      );
    }
    if (a.trainerId) {
      const trainerId = a.trainerId as string;
      await notify(
        trainerId,
        "reminder",
        "Overdue OJT — trainer action",
        `${a.employeeName || "Employee"} — ${a.trainingTopic || "OJT"} is overdue.`,
        `/dashboard/ojt/assignments/${docSnap.id}`,
        `notif_overdue_ojt_${docSnap.id}_${trainerId}_${day}`
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

const OPEN_TRAINING = new Set([
  "assigned",
  "in_progress",
  "training_scheduled",
  "training_completed",
  "assessment_pending",
  "retraining",
]);

const LIFECYCLE_INDEX: Record<string, number> = {
  created: 0,
  hr_verification: 1,
  induction_assigned: 2,
  induction_completed: 3,
  department_handover: 4,
  jd_created: 5,
  tni_created: 6,
  trainer_assigned: 7,
  sop_assigned: 8,
  training: 9,
  exam: 10,
  passed: 11,
  certified: 12,
  qualified: 13,
};

function trainingStillOutstanding(
  rows: Array<{ id: string; sopId?: string; status?: string }>,
  passedAssignmentId: string
): boolean {
  const mapped = rows.map((row) =>
    row.id === passedAssignmentId ? { ...row, status: "passed" } : row
  );
  return mapped.some((row) => {
    if (row.id === passedAssignmentId) return false;
    const status = row.status || "";
    if (status === "passed") return false;
    if (OPEN_TRAINING.has(status)) return true;
    if (status === "failed" || status === "expired") {
      const covered = mapped.some(
        (other) =>
          other.id !== row.id &&
          !!other.sopId &&
          other.sopId === row.sopId &&
          (other.status === "passed" || OPEN_TRAINING.has(other.status || ""))
      );
      return !covered;
    }
    return true;
  });
}

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
      const allAssign = await db
        .collection("training_assignments")
        .where("employeeId", "==", employeeId)
        .get();
      const rows = allAssign.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          sopId: data.sopId as string | undefined,
          status: data.status as string | undefined,
        };
      });
      const outstanding = trainingStillOutstanding(rows, event.params.assignmentId);
      patch = outstanding
        ? { lifecycleStage: "exam", lifecycleProgress: 84, status: "active", updatedAt: now }
        : {
            lifecycleStage: after.certificateId ? "certified" : "passed",
            lifecycleProgress: after.certificateId ? 96 : 90,
            status: "active",
            updatedAt: now,
          };
    }

    if (!patch) return;
    const currentStage = empSnap.data()?.lifecycleStage as string | undefined;
    const currentIdx = currentStage ? LIFECYCLE_INDEX[currentStage] : undefined;
    const targetIdx = LIFECYCLE_INDEX[String(patch.lifecycleStage)];
    const wouldRegress =
      currentIdx !== undefined && targetIdx !== undefined && targetIdx < currentIdx;
    if (!wouldRegress) {
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
    }

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
