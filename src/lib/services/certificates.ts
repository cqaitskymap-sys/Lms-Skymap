/**
 * Certificate issuance, listing, verification, and Storage upload.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import QRCode from "qrcode";
import { db, storage, COLLECTIONS } from "@/lib/firebase/client";
import type {
  Certificate,
  CertificateVerification,
  Employee,
} from "@/types";
import { generateId, nowISO } from "@/lib/services/helpers";
import { generateCertificateNumber } from "@/lib/utils";
import { isDemoMode, DEMO_DEPARTMENTS, DEMO_EMPLOYEES, DEMO_SOPS, DEMO_USERS } from "@/lib/demo/data";
import {
  readCertificateStore,
  upsertCertificateLocal,
  writeCertificateStore,
} from "@/lib/certificates/demo-store";
import { buildCertificatePdf } from "@/lib/certificates/pdf";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "SkyMap Pharma";
const APP_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function preferLocal(): Promise<boolean> {
  if (isDemoMode()) return true;
  try {
    const snap = await getDocs(query(collection(db, COLLECTIONS.certificates), limit(1)));
    return false;
  } catch {
    return true;
  }
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

function resolveTrainerName(trainerId?: string): string {
  if (!trainerId) return "Assigned Trainer";
  for (const u of Object.values(DEMO_USERS)) {
    if (u.profile.uid === trainerId) return u.profile.displayName;
  }
  return "Assigned Trainer";
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
  signedBy?: string;
  signedByTitle?: string;
};

/** Issue a training certificate, generate QR, PDF, and upload to Storage when available. */
export async function issueTrainingCertificate(
  input: IssueCertificateInput
): Promise<Certificate> {
  const local = await preferLocal();
  const now = nowISO();
  const id = generateId("cert");
  const certificateNumber = generateCertificateNumber();

  const emp =
    DEMO_EMPLOYEES.find((e) => e.id === input.employeeId) ||
    (null as Employee | null);
  const sop = DEMO_SOPS.find((s) => s.id === input.sopId);
  const dept = DEMO_DEPARTMENTS.find(
    (d) => d.id === (input.departmentId || emp?.departmentId)
  );

  const employeeName =
    input.employeeName ||
    (emp ? `${emp.firstName} ${emp.lastName}` : input.employeeId);
  const employeeCode = input.employeeCode || emp?.employeeCode || input.employeeId;
  const departmentName = input.departmentName || dept?.name || "—";
  const sopNumber = input.sopNumber || sop?.sopNumber || "SOP";
  const sopTitle = input.sopTitle || sop?.title || "Training";
  const trainerName =
    input.trainerName || resolveTrainerName(input.trainerId);

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
    departmentId: input.departmentId || emp?.departmentId,
    departmentName,
    trainingAssignmentId: input.trainingAssignmentId,
    sopId: input.sopId,
    sopVersionId: input.sopVersionId,
    sopNumber,
    sopTitle,
    examId: input.examId,
    attemptId: input.attemptId,
    title: `Certificate of Training — ${sopTitle}`,
    issuedAt: now,
    score: input.score,
    percentage: input.percentage,
    trainerId: input.trainerId,
    trainerName,
    companyName: COMPANY_NAME,
    companyLogoUrl: "/brand/skymap-logo.svg",
    digitalSignatureUrl: "/brand/qa-signature.svg",
    signedBy: input.signedBy || "Dr. Meera Iyer",
    signedByTitle: input.signedByTitle || "Head of Quality Assurance",
    qrCodeData: verifyUrl,
    qrCodeImageUrl,
    verificationHash,
    isRevoked: false,
    createdAt: now,
    updatedAt: now,
    createdBy: input.actorId,
  };

  // Generate PDF and upload
  try {
    const pdfBlob = await buildCertificatePdf(certificate, qrCodeImageUrl);
    const path = `certificates/${certificateNumber}.pdf`;

    if (local || isDemoMode()) {
      const dataUrl = await blobToDataUrl(pdfBlob);
      certificate = {
        ...certificate,
        pdfStoragePath: `demo/${path}`,
        pdfDownloadUrl: dataUrl,
      };
    } else {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, pdfBlob, { contentType: "application/pdf" });
      const pdfDownloadUrl = await getDownloadURL(storageRef);
      certificate = {
        ...certificate,
        pdfStoragePath: path,
        pdfDownloadUrl,
      };
    }
  } catch {
    /* PDF optional at issue time — can regenerate client-side */
  }

  if (local) {
    upsertCertificateLocal(certificate);
  } else {
    try {
      await setDoc(doc(db, COLLECTIONS.certificates, id), certificate);
    } catch {
      upsertCertificateLocal(certificate);
    }
  }

  return certificate;
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
    return rows;
  }

  try {
    let q = query(collection(db, COLLECTIONS.certificates));
    if (filters?.employeeId) {
      q = query(
        collection(db, COLLECTIONS.certificates),
        where("employeeId", "==", filters.employeeId)
      );
    }
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Certificate);
    if (rows.length) return rows;
  } catch {
    /* fall through */
  }
  return readCertificateStore().certificates.filter((c) =>
    filters?.employeeId ? c.employeeId === filters.employeeId : true
  );
}

export async function getCertificate(id: string): Promise<Certificate | null> {
  if (await preferLocal()) {
    return readCertificateStore().certificates.find((c) => c.id === id) || null;
  }
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.certificates, id));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Certificate;
  } catch {
    /* fall through */
  }
  return readCertificateStore().certificates.find((c) => c.id === id) || null;
}

export async function getCertificateByNumber(
  certificateNumber: string
): Promise<Certificate | null> {
  const normalized = certificateNumber.trim().toUpperCase();
  if (await preferLocal()) {
    return (
      readCertificateStore().certificates.find(
        (c) => c.certificateNumber.toUpperCase() === normalized
      ) || null
    );
  }
  try {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.certificates),
        where("certificateNumber", "==", certificateNumber.trim()),
        limit(1)
      )
    );
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as Certificate;
    }
  } catch {
    /* fall through */
  }
  return (
    readCertificateStore().certificates.find(
      (c) => c.certificateNumber.toUpperCase() === normalized
    ) || null
  );
}

export async function verifyCertificate(
  certificateNumber: string
): Promise<CertificateVerification> {
  const cert = await getCertificateByNumber(certificateNumber);
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
    trainerName: cert.trainerName,
    sopNumber: cert.sopNumber,
    sopTitle: cert.sopTitle,
    issuedAt: cert.issuedAt,
    percentage: cert.percentage,
    companyName: cert.companyName,
    verificationHash: cert.verificationHash,
    message: "Certificate is valid and active.",
  };
}

/** Re-upload / refresh PDF for an existing certificate. */
export async function uploadCertificatePdf(
  certificateId: string,
  blob: Blob
): Promise<{ pdfStoragePath: string; pdfDownloadUrl: string }> {
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
    return { pdfStoragePath: updated.pdfStoragePath!, pdfDownloadUrl };
  }

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: "application/pdf" });
  const pdfDownloadUrl = await getDownloadURL(storageRef);
  await updateDoc(doc(db, COLLECTIONS.certificates, certificateId), {
    pdfStoragePath: path,
    pdfDownloadUrl,
    updatedAt: nowISO(),
  });
  return { pdfStoragePath: path, pdfDownloadUrl };
}

/** Super Admin only — permanently delete a certificate record. */
export async function deleteCertificate(certificateId: string): Promise<void> {
  if (await preferLocal()) {
    const store = readCertificateStore();
    store.certificates = store.certificates.filter((c) => c.id !== certificateId);
    writeCertificateStore(store);
    return;
  }

  await deleteDoc(doc(db, COLLECTIONS.certificates, certificateId));
}
