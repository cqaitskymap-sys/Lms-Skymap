import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  unauthorized,
  verifyAuthDetailed,
  writeAuditLog,
} from "@/lib/rbac/middleware";
import { hasPermission } from "@/lib/rbac/permissions";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { generateId } from "@/lib/utils";
import { generateTemporaryPassword } from "@/lib/onboarding/temp-password";
import { ensureEmployeeAuthAccount } from "@/lib/onboarding/provision-auth";
import { sendOnboardingCredentialsEmail } from "@/lib/onboarding/email";
import type { Employee } from "@/types";

/**
 * Re-issue temporary password and optionally email credentials to HR.
 * Resets mustChangePassword on the user profile.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminConfigured()) {
    return unauthorized(
      "Firebase Admin SDK is required to reset Auth passwords. Save your service-account JSON as firebase-service-account.json and set FIREBASE_ADMIN_CREDENTIALS_FILE=firebase-service-account.json in .env.local (or FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY), then restart the server.",
      503
    );
  }

  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    return unauthorized(
      verified.message,
      verified.reason === "admin_not_configured" ? 503 : 401
    );
  }
  const auth = verified.auth;

  if (
    !hasPermission(auth.role, "employees:email_credentials") &&
    !hasPermission(auth.role, "employees:write")
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const empSnap = await adminDb.collection(COLLECTIONS.employees).doc(id).get();
  if (!empSnap.exists) {
    return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
  }

  let employee = { id: empSnap.id, ...empSnap.data() } as Employee;

  let body: { emailCredentials?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body ok */
  }

  const temporaryPassword = generateTemporaryPassword();
  const now = new Date().toISOString();
  let provisioned = false;

  try {
    if (!employee.userId) {
      const linked = await ensureEmployeeAuthAccount(employee, temporaryPassword, auth.uid);
      employee = linked.employee;
      provisioned = true;
    } else {
      await adminAuth.updateUser(employee.userId, { password: temporaryPassword });
      await adminDb.collection(COLLECTIONS.users).doc(employee.userId).update({
        mustChangePassword: true,
        mustUpdateProfile: true,
        mustAcceptPolicies: true,
        onboardingCompletedAt: null,
        updatedAt: now,
      });
      await adminDb.collection(COLLECTIONS.employees).doc(id).update({
        onboardingStatus: "pending_first_login",
        updatedAt: now,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to provision authentication";
    const status = message.includes("already linked") ? 409 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }

  const username = employee.username || employee.employeeCode;
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`;
  let emailResult: { sent: boolean; reason?: string } = {
    sent: false,
    reason: "Email skipped",
  };

  if (body.emailCredentials !== false) {
    emailResult = await sendOnboardingCredentialsEmail({
      to: auth.email,
      hrName: auth.profile.displayName || auth.email,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeCode: employee.employeeCode,
      username,
      temporaryPassword,
      email: employee.email,
      loginUrl,
      designation: employee.designation,
      departmentName: employee.departmentName,
    });

    if (emailResult.sent) {
      await adminDb.collection(COLLECTIONS.employees).doc(id).update({
        credentialsEmailedAt: now,
        credentialsEmailedTo: auth.email,
      });
    }
  }

  await writeAuditLog({
    actorId: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "update",
    resourceType: "employee",
    resourceId: id,
    description: provisioned
      ? `Provisioned Auth account and issued credentials for ${employee.employeeCode}`
      : `Re-issued temporary credentials for ${employee.employeeCode}`,
    after: { credentialsEmailed: emailResult.sent, provisioned },
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  const actId = generateId("act");
  await adminDb.collection(COLLECTIONS.activityLogs).doc(actId).set({
    id: actId,
    userId: auth.uid,
    employeeId: id,
    verb: "credentials_emailed",
    summary: provisioned
      ? `Auth account provisioned and credentials issued for ${employee.employeeCode}`
      : `Temporary credentials re-issued for ${employee.employeeCode}`,
    resourceType: "employee",
    resourceId: id,
    createdAt: now,
  });

  return NextResponse.json({
    success: true,
    data: {
      credentials: {
        username,
        employeeCode: employee.employeeCode,
        email: employee.email,
        temporaryPassword,
        loginUrl,
        oneTime: true,
      },
      email: emailResult,
    },
  });
}
