import "server-only";

import { createHash } from "crypto";
import QRCode from "qrcode";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { nowISO, stripUndefined } from "@/lib/services/helpers";
import { generateCertificateNumber } from "@/lib/utils";
import {
  COMPUTER_GENERATED_NOTICE,
  PROGRAMME_SOP_ID,
  PROGRAMME_SOP_NUMBER,
  PROGRAMME_TITLE,
} from "@/lib/certificates/copy";
import {
  collectRequiredSopIds,
  evaluateProgrammeEligibility,
  requiredExamsForEmployee,
} from "@/lib/certificates/eligibility";
import type {
  AssessmentAttempt,
  Certificate,
  Employee,
  Exam,
  TrainingAssignment,
  TrainingNeedIdentification,
} from "@/types";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "SkyMap Pharma";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

function hashCertificate(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function programmeDocId(employeeId: string): string {
  return `employee_${employeeId}`;
}

async function findProgrammeCertificate(employeeId: string): Promise<Certificate | null> {
  const byId = await adminDb
    .collection(COLLECTIONS.certificates)
    .doc(programmeDocId(employeeId))
    .get();
  if (byId.exists) {
    const cert = { id: byId.id, ...byId.data() } as Certificate;
    if (!cert.isRevoked) return cert;
  }

  try {
    const snap = await adminDb
      .collection(COLLECTIONS.certificates)
      .where("employeeId", "==", employeeId)
      .limit(20)
      .get();
    const active = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Certificate))
      .find((c) => !c.isRevoked && (c.kind === "programme" || c.sopNumber === PROGRAMME_SOP_NUMBER));
    return active || null;
  } catch {
    return null;
  }
}

async function loadEmployee(employeeId: string): Promise<Employee | null> {
  const snap = await adminDb.collection(COLLECTIONS.employees).doc(employeeId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Employee;
}

async function loadDepartmentName(departmentId?: string): Promise<string> {
  if (!departmentId) return "—";
  const snap = await adminDb.collection(COLLECTIONS.departments).doc(departmentId).get();
  if (!snap.exists) return "—";
  const data = snap.data() as { name?: string };
  return data.name || "—";
}

async function loadRequiredExams(employeeId: string): Promise<Exam[]> {
  const [tniSnap, assignSnap, examsSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.tni).where("employeeId", "==", employeeId).get(),
    adminDb
      .collection(COLLECTIONS.trainingAssignments)
      .where("employeeId", "==", employeeId)
      .get(),
    adminDb.collection(COLLECTIONS.exams).get(),
  ]);

  const tniNeeds = tniSnap.docs.flatMap((d) => {
    const row = d.data() as TrainingNeedIdentification;
    return row.needs || [];
  });
  const assignments = assignSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as TrainingAssignment
  );
  const sopIds = collectRequiredSopIds({ tniNeeds, assignments });
  const exams = examsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Exam));
  return requiredExamsForEmployee(exams, sopIds);
}

async function loadPassedAttempts(employeeId: string): Promise<AssessmentAttempt[]> {
  const snap = await adminDb
    .collection(COLLECTIONS.assessmentAttempts)
    .where("employeeId", "==", employeeId)
    .where("status", "==", "passed")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssessmentAttempt));
}

export type IssueCertificateServerResult =
  | { ok: true; certificate: Certificate; created: boolean }
  | { ok: false; status: number; error: string };

/** Issue one programme certificate after every assigned SOP exam is passed. */
export async function issueCertificateForAttemptServer(
  attemptId: string,
  actorId: string
): Promise<IssueCertificateServerResult> {
  const attemptSnap = await adminDb
    .collection(COLLECTIONS.assessmentAttempts)
    .doc(attemptId)
    .get();
  if (!attemptSnap.exists) {
    return { ok: false, status: 404, error: "Assessment attempt not found" };
  }

  const attempt = { id: attemptSnap.id, ...attemptSnap.data() } as AssessmentAttempt;
  if (attempt.status !== "passed" || !attempt.passed) {
    return { ok: false, status: 400, error: "Attempt is not passed — certificate cannot be issued" };
  }

  const existing = await findProgrammeCertificate(attempt.employeeId);
  if (existing) {
    return { ok: true, certificate: existing, created: false };
  }

  const requiredExams = await loadRequiredExams(attempt.employeeId);
  if (!requiredExams.length) {
    return {
      ok: false,
      status: 409,
      error: "Certificate is issued after all assigned exams are passed — none are assigned yet",
    };
  }

  const attempts = await loadPassedAttempts(attempt.employeeId);
  if (!attempts.some((row) => row.id === attempt.id)) {
    attempts.push(attempt);
  }

  const eligibility = evaluateProgrammeEligibility(requiredExams, attempts);
  if (!eligibility.ready) {
    const remaining = eligibility.remaining.length;
    return {
      ok: false,
      status: 409,
      error: `Certificate is issued after all assigned exams are passed (${remaining} remaining)`,
    };
  }

  const examSnap = await adminDb.collection(COLLECTIONS.exams).doc(attempt.examId).get();
  const exam = examSnap.exists
    ? ({ id: examSnap.id, ...examSnap.data() } as Exam)
    : null;

  let assignment: TrainingAssignment | null = null;
  if (attempt.assignmentId) {
    const assignSnap = await adminDb
      .collection(COLLECTIONS.trainingAssignments)
      .doc(attempt.assignmentId)
      .get();
    if (assignSnap.exists) {
      assignment = { id: assignSnap.id, ...assignSnap.data() } as TrainingAssignment;
    }
  }

  const employee = await loadEmployee(attempt.employeeId);
  const employeeName =
    attempt.employeeName ||
    (employee ? `${employee.firstName} ${employee.lastName}`.trim() : attempt.employeeId);
  const employeeCode = employee?.employeeCode || attempt.employeeId;
  const departmentId = assignment?.departmentId || employee?.departmentId;
  let departmentName = employee?.departmentName || "—";
  if (departmentId && departmentName === "—") {
    departmentName = await loadDepartmentName(departmentId);
  }

  const now = nowISO();
  const id = programmeDocId(attempt.employeeId);
  const certRef = adminDb.collection(COLLECTIONS.certificates).doc(id);
  const programmeTitle = departmentName !== "—"
    ? `${departmentName} Training Programme`
    : PROGRAMME_TITLE;

  try {
    await adminDb.runTransaction(async (tx) => {
      const existingSnap = await tx.get(certRef);
      if (existingSnap.exists) {
        const current = existingSnap.data() as Certificate;
        if (!current.isRevoked) throw new Error("ALREADY_EXISTS");
      }

      const certificateNumber = generateCertificateNumber();
      const verifyUrl = `${APP_URL}/verify/${encodeURIComponent(certificateNumber)}`;
      tx.set(
        certRef,
        stripUndefined({
          id,
          certificateNumber,
          employeeId: attempt.employeeId,
          employeeName,
          employeeCode,
          departmentId,
          departmentName,
          trainingAssignmentId: attempt.assignmentId || `programme_${attempt.employeeId}`,
          sopId: PROGRAMME_SOP_ID,
          sopVersionId: "n/a",
          sopNumber: PROGRAMME_SOP_NUMBER,
          sopTitle: PROGRAMME_TITLE,
          kind: "programme",
          programmeTitle,
          examsCompleted: eligibility.examsCompleted,
          computerGenerated: true,
          examId: exam?.id || attempt.examId,
          attemptId: attempt.id,
          title: `Certificate of Training — ${PROGRAMME_TITLE}`,
          issuedAt: now,
          score: eligibility.averagePercentage,
          percentage: eligibility.averagePercentage,
          trainerName: "—",
          companyName: COMPANY_NAME,
          companyLogoUrl: "/brand/skymap-logo.png",
          qrCodeData: verifyUrl,
          verificationHash: hashCertificate(
            `${certificateNumber}|${employeeCode}|${PROGRAMME_SOP_NUMBER}|${eligibility.averagePercentage}|${now}`
          ),
          isRevoked: false,
          createdAt: now,
          updatedAt: now,
          createdBy: actorId,
        })
      );
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_EXISTS") {
      const again = await findProgrammeCertificate(attempt.employeeId);
      if (again) return { ok: true, certificate: again, created: false };
    }
    const raced = await findProgrammeCertificate(attempt.employeeId);
    if (raced) return { ok: true, certificate: raced, created: false };
    throw err;
  }

  const createdSnap = await certRef.get();
  let certificate = { id: createdSnap.id, ...createdSnap.data() } as Certificate;

  const verifyUrl = certificate.qrCodeData;
  const qrCodeImageUrl = await QRCode.toDataURL(verifyUrl, {
    width: 256,
    margin: 1,
    color: { dark: "#0B3D4A", light: "#FFFFFFF0" },
  });
  await certRef.set({ qrCodeImageUrl, updatedAt: nowISO() }, { merge: true });
  certificate = { ...certificate, qrCodeImageUrl };

  const assignSnap = await adminDb
    .collection(COLLECTIONS.trainingAssignments)
    .where("employeeId", "==", attempt.employeeId)
    .get();
  await Promise.all(
    assignSnap.docs
      .filter((d) => (d.data() as { status?: string }).status === "passed")
      .map((d) =>
        d.ref.set(
          { certificateId: id, updatedAt: now, updatedBy: actorId },
          { merge: true }
        )
      )
  );

  await adminDb
    .collection(COLLECTIONS.employees)
    .doc(attempt.employeeId)
    .set(
      {
        lifecycleStage: "certified",
        lifecycleProgress: 96,
        status: "active",
        updatedAt: now,
        updatedBy: actorId,
      },
      { merge: true }
    );

  try {
    const empSnap = await adminDb
      .collection(COLLECTIONS.employees)
      .doc(attempt.employeeId)
      .get();
    const authUid = (empSnap.data() as { userId?: string } | undefined)?.userId;
    if (authUid) {
      const notifId = `notif_cert_${certificate.id}`;
      await adminDb
        .collection(COLLECTIONS.notifications)
        .doc(notifId)
        .set(
          {
            id: notifId,
            userId: authUid,
            type: "certificate",
            title: "Certificate Issued",
            message: `Your training certificate ${certificate.certificateNumber} is ready.`,
            link: "/dashboard/certificates",
            isRead: false,
            createdAt: now,
            updatedAt: now,
            createdBy: actorId,
            metadata: {
              certificateId: certificate.id,
              certificateNumber: certificate.certificateNumber,
            },
          },
          { merge: true }
        );
    }
  } catch {
    /* non-blocking */
  }

  try {
    await adminDb.collection(COLLECTIONS.auditLogs).doc(`audit_cert_${certificate.id}`).set(
      {
        id: `audit_cert_${certificate.id}`,
        timestamp: now,
        actorId,
        actorEmail: "system@certificates",
        actorRole: "qa",
        action: "create",
        resourceType: "certificate",
        resourceId: certificate.id,
        description: `Certificate ${certificate.certificateNumber} issued for ${certificate.employeeName} after ${eligibility.examsCompleted} exams`,
        after: {
          certificateNumber: certificate.certificateNumber,
          employeeId: certificate.employeeId,
          attemptId: certificate.attemptId,
          percentage: certificate.percentage,
          examsCompleted: eligibility.examsCompleted,
          notice: COMPUTER_GENERATED_NOTICE,
        },
      },
      { merge: true }
    );
  } catch {
    /* non-blocking */
  }

  return {
    ok: true,
    certificate,
    created: true,
  };
}

export type RevokeCertificateServerResult =
  | { ok: true; certificate: Certificate }
  | { ok: false; status: number; error: string };

export async function revokeCertificateServer(
  certificateId: string,
  reason: string,
  actorId: string
): Promise<RevokeCertificateServerResult> {
  const ref = adminDb.collection(COLLECTIONS.certificates).doc(certificateId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, status: 404, error: "Certificate not found" };
  }
  const cert = { id: snap.id, ...snap.data() } as Certificate;
  if (cert.isRevoked) {
    return { ok: true, certificate: cert };
  }
  const now = nowISO();
  await ref.set(
    {
      isRevoked: true,
      revokedReason: reason.trim(),
      revokedAt: now,
      updatedAt: now,
      updatedBy: actorId,
    },
    { merge: true }
  );
  return {
    ok: true,
    certificate: {
      ...cert,
      isRevoked: true,
      revokedReason: reason.trim(),
      revokedAt: now,
    },
  };
}
