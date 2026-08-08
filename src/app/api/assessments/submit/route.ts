import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { unauthorized, verifyAuthDetailed, writeAuditLog } from "@/lib/rbac/middleware";
import { hasPermission } from "@/lib/rbac/permissions";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { submitAssessmentServer } from "@/lib/assessments/server";
import type { AssessmentAttempt } from "@/types";

const bodySchema = z.object({
  attemptId: z.string().trim().min(1),
  answers: z.record(z.string(), z.array(z.string())).default({}),
});

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
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const auth = verified.auth;
  const canTake =
    hasPermission(auth.role, "assessments:take") ||
    hasPermission(auth.role, "assessments:write") ||
    hasPermission(auth.role, "exams:write");
  if (!canTake) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const attemptSnap = await adminDb
    .collection(COLLECTIONS.assessmentAttempts)
    .doc(parsed.data.attemptId)
    .get();
  if (!attemptSnap.exists) {
    return NextResponse.json({ success: false, error: "Attempt not found" }, { status: 404 });
  }

  const attempt = { id: attemptSnap.id, ...attemptSnap.data() } as AssessmentAttempt;
  const profileEmployeeId = auth.profile.employeeId || auth.uid;
  const ownsAttempt =
    attempt.employeeId === profileEmployeeId ||
    attempt.employeeId === auth.uid ||
    attempt.createdBy === auth.uid;
  const isStaff = hasPermission(auth.role, "assessments:write") || auth.role === "super_admin";

  if (!ownsAttempt && !isStaff) {
    return NextResponse.json(
      { success: false, error: "Forbidden: not your attempt" },
      { status: 403 }
    );
  }

  const result = await submitAssessmentServer({
    attemptId: parsed.data.attemptId,
    answers: parsed.data.answers,
    actorId: auth.uid,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  await writeAuditLog({
    actorId: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "submit",
    resourceType: "assessment_attempt",
    resourceId: result.attempt.id,
    description: `Assessment submitted · ${result.attempt.passed ? "PASS" : "FAIL"} · ${result.attempt.percentage ?? 0}%`,
    after: {
      examId: result.attempt.examId,
      employeeId: result.attempt.employeeId,
      passed: result.attempt.passed,
      percentage: result.attempt.percentage,
      assignmentId: result.attempt.assignmentId,
    },
  });

  return NextResponse.json({ success: true, attempt: result.attempt });
}
