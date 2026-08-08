import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { issueCertificateForAttemptServer } from "@/lib/certificates/issue-server";
import { hasPermission } from "@/lib/rbac/permissions";
import { unauthorized, verifyAuthDetailed } from "@/lib/rbac/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { AssessmentAttempt } from "@/types";

const bodySchema = z.object({
  attemptId: z.string().trim().min(1, "attemptId is required"),
});

function canIssueForAttempt(
  auth: { uid: string; profile: { employeeId?: string }; role: string },
  attempt: AssessmentAttempt
): boolean {
  if (hasPermission(auth.role as Parameters<typeof hasPermission>[0], "certificates:issue")) {
    return true;
  }
  const employeeId = auth.profile.employeeId;
  return (
    attempt.employeeId === auth.uid ||
    (!!employeeId && attempt.employeeId === employeeId) ||
    attempt.createdBy === auth.uid
  );
}

export async function POST(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors.attemptId?.[0] || "Invalid request" },
      { status: 400 }
    );
  }

  const { attemptId } = parsed.data;

  const attemptSnap = await adminDb
    .collection(COLLECTIONS.assessmentAttempts)
    .doc(attemptId)
    .get();
  if (!attemptSnap.exists) {
    return NextResponse.json({ success: false, error: "Attempt not found" }, { status: 404 });
  }

  const attempt = { id: attemptSnap.id, ...attemptSnap.data() } as AssessmentAttempt;
  if (!canIssueForAttempt(verified.auth, attempt)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: you cannot issue a certificate for this attempt" },
      { status: 403 }
    );
  }

  const result = await issueCertificateForAttemptServer(attemptId, verified.auth.uid);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    certificate: result.certificate,
    created: result.created,
  });
}
