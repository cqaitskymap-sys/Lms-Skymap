import "server-only";

import { createHash } from "crypto";
import QRCode from "qrcode";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
const CERTIFICATE_SIGNED_BY = "ONS SIR";
const CERTIFICATE_SIGNED_BY_TITLE = "Head of Quality Assurance";

function resolveCertificateSignatory(signedBy?: string | null): string {
  const name = (signedBy || "").trim();
  const legacy = new Set(["dr. meera iyer", "meera iyer", "authorized signatory"]);
  if (!name || legacy.has(name.toLowerCase())) return CERTIFICATE_SIGNED_BY;
  return name;
}
import { nowISO, stripUndefined } from "@/lib/services/helpers";
import { generateCertificateNumber } from "@/lib/utils";
import type {
  AssessmentAttempt,
  Certificate,
  Employee,
  Exam,
  SopDocument,
  TrainerProfile,
  TrainingAssignment,
} from "@/types";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "SkyMap Pharma";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

function hashCertificate(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function findCertificateByAttempt(attemptId: string): Promise<Certificate | null> {
  const byId = await adminDb
    .collection(COLLECTIONS.certificates)
    .doc(`attempt_${attemptId}`)
    .get();
  if (byId.exists) {
    return { id: byId.id, ...byId.data() } as Certificate;
  }
  const snap = await adminDb
    .collection(COLLECTIONS.certificates)
    .where("attemptId", "==", attemptId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...d.data() } as Certificate;
}

async function loadEmployee(employeeId: string): Promise<Employee | null> {
  const snap = await adminDb.collection(COLLECTIONS.employees).doc(employeeId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Employee;
}

async function loadSop(sopId: string): Promise<SopDocument | null> {
  const snap = await adminDb.collection(COLLECTIONS.sops).doc(sopId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as SopDocument;
}

async function loadTrainer(trainerId?: string): Promise<TrainerProfile | null> {
  if (!trainerId) return null;
  const byId = await adminDb.collection(COLLECTIONS.trainers).doc(trainerId).get();
  if (byId.exists) {
    return { id: byId.id, ...byId.data() } as TrainerProfile;
  }
  const byUser = await adminDb
    .collection(COLLECTIONS.trainers)
    .where("userId", "==", trainerId)
    .limit(1)
    .get();
  if (byUser.empty) return null;
  const doc = byUser.docs[0]!;
  return { id: doc.id, ...doc.data() } as TrainerProfile;
}

async function loadDepartmentName(departmentId?: string): Promise<string> {
  if (!departmentId) return "—";
  const snap = await adminDb.collection(COLLECTIONS.departments).doc(departmentId).get();
  if (!snap.exists) return "—";
  const data = snap.data() as { name?: string };
  return data.name || "—";
}

export type IssueCertificateServerResult =
  | { ok: true; certificate: Certificate; created: boolean }
  | { ok: false; status: number; error: string };

/** Issue (or return existing) certificate for a passed, eligible attempt — Admin SDK only. */
export async function issueCertificateForAttemptServer(
  attemptId: string,
  actorId: string
): Promise<IssueCertificateServerResult> {
  const existing = await findCertificateByAttempt(attemptId);
  if (existing) {
    return { ok: true, certificate: existing, created: false };
  }

  const attemptSnap = await adminDb
    .collection(COLLECTIONS.assessmentAttempts)
    .doc(attemptId)
    .get();
  if (!attemptSnap.exists) {
    return { ok: false, status: 404, error: "Assessment attempt not found" };
  }

  const attempt = { id: attemptSnap.id, ...attemptSnap.data() } as AssessmentAttempt;
  if (!["passed"].includes(attempt.status)) {
    return { ok: false, status: 400, error: "Attempt is not passed — certificate cannot be issued" };
  }
  if (!attempt.certificateEligible) {
    return {
      ok: false,
      status: 400,
      error: "Attempt is not certificate eligible (score below certificate threshold)",
    };
  }

  const examSnap = await adminDb.collection(COLLECTIONS.exams).doc(attempt.examId).get();
  if (!examSnap.exists) {
    return { ok: false, status: 404, error: "Exam not found" };
  }
  const exam = { id: examSnap.id, ...examSnap.data() } as Exam;

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

  const sopId = assignment?.sopId || exam.sopId || exam.inductionModuleId || `standalone_${exam.id}`;
  const sopVersionId = assignment?.sopVersionId || "n/a";
  let sopNumber = "SOP";
  let sopTitle = exam.title || "Training";
  const trainerId = assignment?.trainerId;
  const departmentId = assignment?.departmentId || employee?.departmentId;
  let departmentName = employee?.departmentName || "—";

  const sop = sopId.startsWith("standalone_") ? null : await loadSop(sopId);
  if (sop) {
    sopNumber = sop.sopNumber;
    sopTitle = sop.title;
  }

  if (departmentId && departmentName === "—") {
    departmentName = await loadDepartmentName(departmentId);
  }

  const trainer = await loadTrainer(trainerId);
  let trainerName = "Assigned Trainer";
  if (trainer?.userId) {
    const userSnap = await adminDb.collection(COLLECTIONS.users).doc(trainer.userId).get();
    if (userSnap.exists) {
      const user = userSnap.data() as { displayName?: string };
      if (user.displayName) trainerName = user.displayName;
    }
  }

  const now = nowISO();
  const id = `attempt_${attemptId}`;
  const certRef = adminDb.collection(COLLECTIONS.certificates).doc(id);

  // Transactional create — doc id is unique per attempt
  try {
    await adminDb.runTransaction(async (tx) => {
      const existingSnap = await tx.get(certRef);
      if (existingSnap.exists) {
        throw new Error("ALREADY_EXISTS");
      }

      const certificateNumber = generateCertificateNumber();
      const verifyUrl = `${APP_URL}/verify/${encodeURIComponent(certificateNumber)}`;
      // QR generated outside would be nicer; keep sync-friendly placeholder then update
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
          trainingAssignmentId: attempt.assignmentId || `standalone_${attempt.id}`,
          sopId,
          sopVersionId,
          sopNumber,
          sopTitle,
          examId: exam.id,
          attemptId: attempt.id,
          title: `Certificate of Training — ${sopTitle}`,
          issuedAt: now,
          score: attempt.score || 0,
          percentage: attempt.percentage || 0,
          trainerId,
          trainerName,
          companyName: COMPANY_NAME,
          companyLogoUrl: "/brand/skymap-logo.png",
          digitalSignatureUrl: "/brand/qa-signature.svg",
          signedBy: resolveCertificateSignatory(undefined),
          signedByTitle: CERTIFICATE_SIGNED_BY_TITLE,
          qrCodeData: verifyUrl,
          verificationHash: hashCertificate(
            `${certificateNumber}|${employeeCode}|${sopNumber}|${attempt.percentage}|${now}`
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
      const again = await findCertificateByAttempt(attemptId);
      if (again) return { ok: true, certificate: again, created: false };
    }
    // Fall through if race lost — re-read
    const raced = await findCertificateByAttempt(attemptId);
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

  if (attempt.assignmentId && assignment) {
    await adminDb
      .collection(COLLECTIONS.trainingAssignments)
      .doc(attempt.assignmentId)
      .set(
        stripUndefined({
          status: "passed",
          score: attempt.percentage,
          passed: true,
          assessmentAttemptId: attempt.id,
          certificateId: id,
          updatedAt: now,
          updatedBy: actorId,
        }),
        { merge: true }
      );
  }

  // Mark employee certified for this SOP — do not auto-qualify org-wide
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

  // Inbox: notify employee when a new certificate is issued
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
            message: `Your training certificate ${certificate.certificateNumber} for ${certificate.sopTitle} is ready.`,
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
        description: `Certificate ${certificate.certificateNumber} issued for ${certificate.employeeName} · ${certificate.sopNumber}`,
        after: {
          certificateNumber: certificate.certificateNumber,
          employeeId: certificate.employeeId,
          attemptId: certificate.attemptId,
          percentage: certificate.percentage,
        },
      },
      { merge: true }
    );
  } catch {
    /* non-blocking */
  }

  return {
    ok: true,
    certificate: {
      ...certificate,
      signedBy: resolveCertificateSignatory(certificate.signedBy),
    },
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
