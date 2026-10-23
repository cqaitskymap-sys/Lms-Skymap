import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { issueCertificateForAttemptServer } from "@/lib/certificates/issue-server";
import { unauthorized, verifyAuthDetailed, authHttpStatus } from "@/lib/rbac/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { AssessmentAttempt, Certificate } from "@/types";

export async function POST(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = authHttpStatus(verified.reason);
    return unauthorized(verified.message, status);
  }

  if (verified.auth.role !== "employee") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const employeeId = verified.auth.profile.employeeId || verified.auth.uid;
  const attemptsSnap = await adminDb
    .collection(COLLECTIONS.assessmentAttempts)
    .where("employeeId", "==", employeeId)
    .where("status", "==", "passed")
    .get();

  const attempts = attemptsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as AssessmentAttempt))
    .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));

  if (!attempts.length) {
    return NextResponse.json({
      success: true,
      issuedCount: 0,
      certificates: [] as Certificate[],
      skippedAttemptIds: [] as string[],
      errors: [] as Array<{ attemptId: string; error: string }>,
    });
  }

  const latest = attempts[0]!;
  const result = await issueCertificateForAttemptServer(latest.id, verified.auth.uid);
  if (result.ok) {
    return NextResponse.json({
      success: true,
      issuedCount: result.created ? 1 : 0,
      certificates: [result.certificate],
      skippedAttemptIds: [] as string[],
      errors: [] as Array<{ attemptId: string; error: string }>,
    });
  }

  if (result.status === 409) {
    return NextResponse.json({
      success: true,
      issuedCount: 0,
      certificates: [] as Certificate[],
      skippedAttemptIds: attempts.map((a) => a.id),
      errors: [] as Array<{ attemptId: string; error: string }>,
      message: result.error,
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: result.error,
      issuedCount: 0,
      certificates: [] as Certificate[],
      skippedAttemptIds: [] as string[],
      errors: [{ attemptId: latest.id, error: result.error }],
    },
    { status: result.status }
  );
}
