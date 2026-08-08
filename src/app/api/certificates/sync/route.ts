import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { issueCertificateForAttemptServer } from "@/lib/certificates/issue-server";
import { unauthorized, verifyAuthDetailed } from "@/lib/rbac/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { AssessmentAttempt, Certificate } from "@/types";

export async function POST(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  const employeeId = verified.auth.profile.employeeId || verified.auth.uid;
  const attemptsSnap = await adminDb
    .collection(COLLECTIONS.assessmentAttempts)
    .where("employeeId", "==", employeeId)
    .where("status", "==", "passed")
    .get();

  const issued: Certificate[] = [];
  const skipped: string[] = [];
  const errors: Array<{ attemptId: string; error: string }> = [];

  for (const doc of attemptsSnap.docs) {
    const attempt = { id: doc.id, ...doc.data() } as AssessmentAttempt;
    if (!attempt.certificateEligible) {
      skipped.push(attempt.id);
      continue;
    }

    const result = await issueCertificateForAttemptServer(attempt.id, verified.auth.uid);
    if (result.ok) {
      issued.push(result.certificate);
    } else {
      errors.push({ attemptId: attempt.id, error: result.error });
    }
  }

  return NextResponse.json({
    success: true,
    issuedCount: issued.length,
    certificates: issued,
    skippedAttemptIds: skipped,
    errors,
  });
}
