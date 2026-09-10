/**
 * Certificate issuance, listing, verification, and Storage upload.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  deleteDoc,
  where,
  limit,
} from "firebase/firestore/lite";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import QRCode from "qrcode";
import { db, storage, COLLECTIONS } from "@/lib/firebase/client";
import type {
  Certificate,
  CertificateVerification,
} from "@/types";
import { nowISO } from "@/lib/services/helpers";
import { generateCertificateNumber } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo/data";
import {
  readCertificateStore,
  upsertCertificateLocal,
  writeCertificateStore,
} from "@/lib/certificates/demo-store";
import { buildCertificatePdf } from "@/lib/certificates/pdf";
import {
  PROGRAMME_SOP_ID,
  PROGRAMME_SOP_NUMBER,
  PROGRAMME_TITLE,
} from "@/lib/certificates/copy";
import {
  collectRequiredSopIds,
  evaluateProgrammeEligibility,
  requiredExamsForEmployee,
} from "@/lib/certificates/eligibility";
import type { AssessmentAttempt, Exam } from "@/types";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "SkyMap Pharma";
const APP_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function normalizeCertificate(cert: Certificate): Certificate {
  return {
    ...cert,
    computerGenerated: true,
    kind: cert.kind || (cert.sopNumber === PROGRAMME_SOP_NUMBER ? "programme" : cert.kind),
    programmeTitle: cert.programmeTitle || (cert.sopNumber === PROGRAMME_SOP_NUMBER ? PROGRAMME_TITLE : cert.programmeTitle),
  };
}

const STORAGE_UNAVAILABLE_KEY = "pharma_lms_storage_unavailable";

function isStorageMarkedUnavailable(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STORAGE_UNAVAILABLE_KEY) === "1";
}

function markStorageUnavailable(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_UNAVAILABLE_KEY, "1");
  console.warn(
    "[storage] Firebase Storage unavailable (bucket missing / billing / CORS). Using local PDF data URLs until the session ends."
  );
}

/** Upload PDF to Storage, or fall back to a data URL when the bucket is unavailable. */
async function storeCertificatePdf(
  path: string,
  pdfBlob: Blob
): Promise<{ pdfStoragePath: string; pdfDownloadUrl: string }> {
  if (!isStorageMarkedUnavailable()) {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, pdfBlob, { contentType: "application/pdf" });
      const pdfDownloadUrl = await getDownloadURL(storageRef);
      return { pdfStoragePath: path, pdfDownloadUrl };
    } catch {
      markStorageUnavailable();
    }
  }

  const pdfDownloadUrl = await blobToDataUrl(pdfBlob);
  return { pdfStoragePath: `local/${path}`, pdfDownloadUrl };
}

async function preferLocal(): Promise<boolean> {
  return isDemoMode();
}

async function hashString(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

export type IssueCertificateInput = {
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  departmentId?: string;
  departmentName?: string;
  trainingAssignmentId: string;
  sopId: string;
  sopVersionId: string;
  sopNumber?: string;
  sopTitle?: string;
  examId: string;
  attemptId: string;
  score: number;
  percentage: number;
  trainerId?: string;
  trainerName?: string;
  actorId: string;
  programmeTitle?: string;
  examsCompleted?: number;
};

/** Issue certificate via server API (bypasses Firestore rules for employees). */
export async function issueCertificateForAttempt(attemptId: string): Promise<Certificate | null> {
  if (await preferLocal()) return null;

  const { auth } = await import("@/lib/firebase/client");
  const user = auth.currentUser;
  if (!user) {
    console.warn("[certificate] issue skipped — not signed in");
    return null;
  }

  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/certificates/issue", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ attemptId }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      console.error("[certificate] API issue failed:", body.error || res.status);
      return null;
    }

    const body = (await res.json()) as { certificate?: Certificate };
    return body.certificate || null;
  } catch (err) {
    console.error("[certificate] API issue error:", err);
    return null;
  }
}

/** Issue one programme certificate when every assigned SOP exam is passed. */
export async function maybeIssueProgrammeCertificate(params: {
  employeeId: string;
  attemptId: string;
  actorId: string;
}): Promise<Certificate | null> {
  if (!(await preferLocal())) {
    return issueCertificateForAttempt(params.attemptId);
  }

  const existing = readCertificateStore().certificates.find(
    (c) =>
      c.employeeId === params.employeeId &&
      !c.isRevoked &&
      (c.kind === "programme" || c.sopNumber === PROGRAMME_SOP_NUMBER)
  );
  if (existing) return normalizeCertificate(existing);

  const { listTNIs, getEmployeeAssignments } = await import("@/lib/services/training");
  const { listExams } = await import("@/lib/services/assessments");
  const { readAssessmentStore } = await import("@/lib/assessments/demo-store");
  const { getEmployee } = await import("@/lib/services/employees");

  const [tnis, assignments, exams, employee] = await Promise.all([
    listTNIs({ employeeId: params.employeeId }).catch(() => []),
    getEmployeeAssignments(params.employeeId).catch(() => []),
    listExams().catch(() => [] as Exam[]),
    getEmployee(params.employeeId).catch(() => null),
  ]);

  const sopIds = collectRequiredSopIds({
    tniNeeds: tnis.flatMap((t) => t.needs || []),
    assignments,
  });
  const requiredExams = requiredExamsForEmployee(exams, sopIds);
  if (!requiredExams.length) return null;

  const attempts = readAssessmentStore().attempts.filter(
    (a) => a.employeeId === params.employeeId
  ) as AssessmentAttempt[];
  const eligibility = evaluateProgrammeEligibility(requiredExams, attempts);
  if (!eligibility.ready) return null;

  const trigger =
    attempts.find((a) => a.id === params.attemptId) ||
    attempts
      .filter((a) => a.status === "passed")
      .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))[0];
  if (!trigger) return null;

  const employeeName = employee
    ? `${employee.firstName} ${employee.lastName}`.trim()
    : trigger.employeeName || params.employeeId;
  const departmentName = employee?.departmentName || "—";
  const programmeTitle =
    departmentName !== "—" ? `${departmentName} Training Programme` : PROGRAMME_TITLE;

  const certificate = await issueTrainingCertificate({
    employeeId: params.employeeId,
    employeeName,
    employeeCode: employee?.employeeCode,
    departmentId: employee?.departmentId,
    departmentName,
    trainingAssignmentId: trigger.assignmentId || `programme_${params.employeeId}`,
    sopId: PROGRAMME_SOP_ID,
    sopVersionId: "n/a",
    sopNumber: PROGRAMME_SOP_NUMBER,
    sopTitle: PROGRAMME_TITLE,
    examId: trigger.examId,
    attemptId: trigger.id,
    score: eligibility.averagePercentage,
    percentage: eligibility.averagePercentage,
    actorId: params.actorId,
    programmeTitle,
    examsCompleted: eligibility.examsCompleted,
  });
  try {
    const { markCertifiedLifecycle } = await import("@/lib/services/lifecycle");
    await markCertifiedLifecycle(params.employeeId, certificate.id, {
      uid: params.actorId,
      name: "Assessment Engine",
      role: "super_admin",
    });
  } catch {
    /* lifecycle optional in demo */
  }
  return certificate;
}

/** Issue a training certificate, generate QR, PDF, and upload to Storage when available. */
export async function issueTrainingCertificate(
  input: IssueCertificateInput
): Promise<Certificate> {
  // Live mode: always go through server API for dedupe + rules
  if (!(await preferLocal())) {
    const viaApi = await issueCertificateForAttempt(input.attemptId);
    if (viaApi) return viaApi;
    throw new Error("Failed to issue certificate via server");
  }

  const now = nowISO();
  const id = `employee_${input.employeeId}`;
  const already = readCertificateStore().certificates.find((c) => c.id === id && !c.isRevoked);
  if (already) return normalizeCertificate(already);

  const certificateNumber = generateCertificateNumber();
  const employeeName = input.employeeName || input.employeeId;
  const employeeCode = input.employeeCode || input.employeeId;
  const departmentName = input.departmentName || "—";
  const sopNumber = input.sopNumber || PROGRAMME_SOP_NUMBER;
  const sopTitle = input.sopTitle || PROGRAMME_TITLE;
  const programmeTitle = input.programmeTitle || sopTitle;

  const verifyUrl = `${APP_URL}/verify/${encodeURIComponent(certificateNumber)}`;
  const qrCodeImageUrl = await QRCode.toDataURL(verifyUrl, {
    width: 256,
    margin: 1,
    color: { dark: "#0B3D4A", light: "#FFFFFFF0" },
  });

  const verificationHash = await hashString(
    `${certificateNumber}|${employeeCode}|${sopNumber}|${input.percentage}|${now}`
  );

  let certificate: Certificate = {
    id,
    certificateNumber,
    employeeId: input.employeeId,
    employeeName,
    employeeCode,
    departmentId: input.departmentId,
    departmentName,
    trainingAssignmentId: input.trainingAssignmentId,
    sopId: input.sopId,
    sopVersionId: input.sopVersionId,
    sopNumber,
    sopTitle,
    kind: "programme",
    programmeTitle,
    examsCompleted: input.examsCompleted,
    computerGenerated: true,
    examId: input.examId,
    attemptId: input.attemptId,
    title: `Certificate of Training — ${PROGRAMME_TITLE}`,
    issuedAt: now,
    score: input.score,
    percentage: input.percentage,
    trainerName: "—",
    companyName: COMPANY_NAME,
    companyLogoUrl: "/brand/skymap-logo.png",
    qrCodeData: verifyUrl,
    qrCodeImageUrl,
    verificationHash,
    isRevoked: false,
    createdAt: now,
    updatedAt: now,
    createdBy: input.actorId,
  };

  try {
    const pdfBlob = await buildCertificatePdf(certificate, qrCodeImageUrl);
    const path = `certificates/${certificateNumber}.pdf`;
    const dataUrl = await blobToDataUrl(pdfBlob);
    certificate = {
      ...certificate,
      pdfStoragePath: `demo/${path}`,
      pdfDownloadUrl: dataUrl,
    };
  } catch {
    /* PDF optional */
  }

  upsertCertificateLocal(certificate);
  return normalizeCertificate(certificate);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function listCertificates(filters?: {
  employeeId?: string;
}): Promise<Certificate[]> {
  if (await preferLocal()) {
    let rows = readCertificateStore().certificates;
    if (filters?.employeeId) {
      rows = rows.filter((c) => c.employeeId === filters.employeeId);
    }
    return rows.map(normalizeCertificate);
  }

  let q = query(collection(db, COLLECTIONS.certificates));
  if (filters?.employeeId) {
    q = query(
      collection(db, COLLECTIONS.certificates),
      where("employeeId", "==", filters.employeeId)
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    normalizeCertificate({ id: d.id, ...d.data() } as Certificate)
  );
}

export async function getCertificate(id: string): Promise<Certificate | null> {
  if (await preferLocal()) {
    const found = readCertificateStore().certificates.find((c) => c.id === id);
    return found ? normalizeCertificate(found) : null;
  }
  const snap = await getDoc(doc(db, COLLECTIONS.certificates, id));
  if (!snap.exists()) return null;
  return normalizeCertificate({ id: snap.id, ...snap.data() } as Certificate);
}

export async function getCertificateByNumber(
  certificateNumber: string
): Promise<Certificate | null> {
  const normalized = certificateNumber.trim().toUpperCase();
  if (await preferLocal()) {
    const found = readCertificateStore().certificates.find(
      (c) => c.certificateNumber.toUpperCase() === normalized
    );
    return found ? normalizeCertificate(found) : null;
  }

  // Prefer public verify API (works without open Firestore reads)
  try {
    const res = await fetch(
      `/api/certificates/verify?number=${encodeURIComponent(normalized)}`
    );
    if (res.ok) {
      const body = (await res.json()) as { certificate?: Certificate | null };
      if (body.certificate) return normalizeCertificate(body.certificate as Certificate);
      return null;
    }
  } catch {
    /* fall through */
  }

  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.certificates),
      where("certificateNumber", "==", normalized),
      limit(1)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return normalizeCertificate({ id: d.id, ...d.data() } as Certificate);
}

export async function verifyCertificate(
  certificateNumber: string
): Promise<CertificateVerification> {
  const normalized = certificateNumber.trim().toUpperCase();

  if (!(await preferLocal())) {
    try {
      const res = await fetch(
        `/api/certificates/verify?number=${encodeURIComponent(normalized)}`
      );
      if (res.ok) {
        const body = (await res.json()) as { verification?: CertificateVerification };
        if (body.verification) return body.verification;
      }
    } catch {
      /* fall through to local/firestore */
    }
  }

  const cert = await getCertificateByNumber(normalized);
  if (!cert) {
    return {
      valid: false,
      message: "No certificate found for this number.",
    };
  }
  if (cert.isRevoked) {
    return {
      valid: false,
      revoked: true,
      certificateNumber: cert.certificateNumber,
      message: cert.revokedReason || "This certificate has been revoked.",
    };
  }
  return {
    valid: true,
    certificateNumber: cert.certificateNumber,
    employeeName: cert.employeeName,
    employeeCode: cert.employeeCode,
    departmentName: cert.departmentName,
    programmeTitle: cert.programmeTitle || cert.sopTitle,
    examsCompleted: cert.examsCompleted,
    sopNumber: cert.sopNumber,
    sopTitle: cert.sopTitle,
    issuedAt: cert.issuedAt,
    percentage: cert.percentage,
    companyName: cert.companyName,
    verificationHash: cert.verificationHash,
    message: "Certificate is valid and active.",
  };
}

export async function revokeCertificate(
  certificateId: string,
  reason: string
): Promise<Certificate> {
  if (await preferLocal()) {
    const store = readCertificateStore();
    const idx = store.certificates.findIndex((c) => c.id === certificateId);
    if (idx < 0) throw new Error("Certificate not found");
    const now = nowISO();
    const updated = {
      ...store.certificates[idx]!,
      isRevoked: true,
      revokedReason: reason.trim(),
      revokedAt: now,
      updatedAt: now,
    };
    store.certificates[idx] = updated;
    writeCertificateStore(store);
    return normalizeCertificate(updated);
  }

  const { auth } = await import("@/lib/firebase/client");
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required");
  const token = await user.getIdToken();
  const res = await fetch("/api/certificates/revoke", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ certificateId, reason }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    certificate?: Certificate;
  };
  if (!res.ok || !body.certificate) {
    throw new Error(body.error || "Failed to revoke certificate");
  }
  return normalizeCertificate(body.certificate);
}

/** Re-upload / refresh PDF for an existing certificate. */
export async function uploadCertificatePdf(
  certificateId: string,
  blob: Blob
): Promise<{ pdfStoragePath: string; pdfDownloadUrl: string; storedRemotely: boolean }> {
  const cert = await getCertificate(certificateId);
  if (!cert) throw new Error("Certificate not found");

  const path = `certificates/${cert.certificateNumber}.pdf`;

  if ((await preferLocal()) || isDemoMode()) {
    const pdfDownloadUrl = await blobToDataUrl(blob);
    const updated = {
      ...cert,
      pdfStoragePath: `demo/${path}`,
      pdfDownloadUrl,
      updatedAt: nowISO(),
    };
    upsertCertificateLocal(updated);
    return {
      pdfStoragePath: updated.pdfStoragePath!,
      pdfDownloadUrl,
      storedRemotely: false,
    };
  }

  const stored = await storeCertificatePdf(path, blob);
  const storedRemotely = !stored.pdfStoragePath.startsWith("local/");
  await updateDoc(doc(db, COLLECTIONS.certificates, certificateId), {
    ...stored,
    updatedAt: nowISO(),
  });
  return { ...stored, storedRemotely };
}

/** Super Admin only — permanently delete a certificate record. */
export async function deleteCertificate(certificateId: string): Promise<void> {
  if (await preferLocal()) {
    const store = readCertificateStore();
    store.certificates = store.certificates.filter((c) => c.id !== certificateId);
    writeCertificateStore(store);
    return;
  }

  const snap = await getDoc(doc(db, COLLECTIONS.certificates, certificateId));
  if (snap.exists()) {
    const cert = snap.data() as Certificate;
    if (cert.trainingAssignmentId && !cert.trainingAssignmentId.startsWith("standalone_")) {
      try {
        await updateDoc(doc(db, COLLECTIONS.trainingAssignments, cert.trainingAssignmentId), {
          certificateId: null,
          updatedAt: nowISO(),
        });
      } catch {
        /* assignment may be missing */
      }
    }
  }

  await deleteDoc(doc(db, COLLECTIONS.certificates, certificateId));
}
