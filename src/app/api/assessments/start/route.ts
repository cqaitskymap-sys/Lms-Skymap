import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { unauthorized, verifyAuthDetailed } from "@/lib/rbac/middleware";
import { hasPermission } from "@/lib/rbac/permissions";
import { startAssessmentServer } from "@/lib/assessments/server";

const bodySchema = z.object({
  examId: z.string().trim().min(1),
  employeeId: z.string().trim().min(1).optional(),
  employeeName: z.string().optional(),
  assignmentId: z.string().trim().min(1).optional(),
  inductionAssignmentId: z.string().trim().min(1).optional(),
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

  const profileEmployeeId = auth.profile.employeeId || auth.uid;
  let employeeId = parsed.data.employeeId || profileEmployeeId;

  // Employees may only start for themselves
  if (auth.role === "employee") {
    employeeId = profileEmployeeId;
  }

  // Formal assigned takes always enforce maxAttempts. The Exams "Start" button for
  // admin/HR/QA is a preview/test path — those roles already burned attempts while
  // testing and should not be hard-blocked by the learner attempt cap.
  const isAssignedTake = Boolean(
    parsed.data.assignmentId || parsed.data.inductionAssignmentId
  );
  const enforceMaxAttempts = auth.role === "employee" || isAssignedTake;

  const result = await startAssessmentServer({
    examId: parsed.data.examId,
    employeeId,
    employeeName: parsed.data.employeeName || auth.profile.displayName,
    assignmentId: parsed.data.assignmentId,
    inductionAssignmentId: parsed.data.inductionAssignmentId,
    actorId: auth.uid,
    enforceMaxAttempts,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    attempt: result.attempt,
    resumed: result.resumed,
  });
}
