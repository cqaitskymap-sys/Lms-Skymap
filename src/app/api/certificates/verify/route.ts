import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { Certificate, CertificateVerification } from "@/types";

/**
 * Public certificate verification — Admin SDK only (no open Firestore reads).
 * GET /api/certificates/verify?number=CERT-YYYY-######
 */
export async function GET(request: NextRequest) {
  const number = request.nextUrl.searchParams.get("number")?.trim().toUpperCase();
  if (!number) {
    return NextResponse.json(
      { success: false, error: "Certificate number is required" },
      { status: 400 }
    );
  }

  const snap = await adminDb
    .collection(COLLECTIONS.certificates)
    .where("certificateNumber", "==", number)
    .limit(1)
    .get();

  if (snap.empty) {
    const verification: CertificateVerification = {
      valid: false,
      message: "No certificate found for this number.",
    };
    return NextResponse.json({ success: true, verification, certificate: null });
  }

  const cert = { id: snap.docs[0]!.id, ...snap.docs[0]!.data() } as Certificate;

  if (cert.isRevoked) {
    const verification: CertificateVerification = {
      valid: false,
      revoked: true,
      certificateNumber: cert.certificateNumber,
      message: cert.revokedReason || "This certificate has been revoked.",
    };
    return NextResponse.json({ success: true, verification, certificate: null });
  }

  const verification: CertificateVerification = {
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

  // Public payload — omit internal ids / storage paths that aren't needed for display
  const publicCert = {
    id: cert.id,
    certificateNumber: cert.certificateNumber,
    employeeName: cert.employeeName,
    employeeCode: cert.employeeCode,
    departmentName: cert.departmentName,
    trainerName: cert.trainerName,
    sopNumber: cert.sopNumber,
    sopTitle: cert.sopTitle,
    title: cert.title,
    issuedAt: cert.issuedAt,
    score: cert.score,
    percentage: cert.percentage,
    companyName: cert.companyName,
    companyLogoUrl: cert.companyLogoUrl,
    digitalSignatureUrl: cert.digitalSignatureUrl,
    signedBy: cert.signedBy,
    signedByTitle: cert.signedByTitle,
    qrCodeData: cert.qrCodeData,
    qrCodeImageUrl: cert.qrCodeImageUrl,
    verificationHash: cert.verificationHash,
    isRevoked: false,
  };

  return NextResponse.json({
    success: true,
    verification,
    certificate: publicCert,
  });
}
