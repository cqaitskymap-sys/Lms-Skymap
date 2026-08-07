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
import {
  onboardEmployeeSchema,
  resolveOnboardingEmail,
} from "@/lib/auth/onboarding-schemas";
import { generateTemporaryPassword } from "@/lib/onboarding/temp-password";
import { sendOnboardingCredentialsEmail } from "@/lib/onboarding/email";
import { getProgressForStage, getStageDefinition } from "@/lib/lifecycle/stages";
import type { Employee, UserProfile } from "@/types";

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return unauthorized(
        "Firebase Admin SDK is required to create Auth accounts. Save your service-account JSON as firebase-service-account.json in the project root and set FIREBASE_ADMIN_CREDENTIALS_FILE=firebase-service-account.json in .env.local (or set FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY), then restart npm run dev.",
      503
    );
  }

  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }
  const auth = verified.auth;

  if (
    !hasPermission(auth.role, "employees:onboard") &&
    !hasPermission(auth.role, "employees:write")
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = onboardEmployeeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const now = new Date().toISOString();
  const ip = request.headers.get("x-forwarded-for") || undefined;
  const ua = request.headers.get("user-agent") || undefined;

  const employeeCode = input.employeeCode;
  const email = resolveOnboardingEmail(input.email, employeeCode);

  // Uniqueness: email (only when a real work email was provided, or derived address)
  const emailSnap = await adminDb
    .collection(COLLECTIONS.employees)
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!emailSnap.empty) {
    return NextResponse.json(
      { success: false, error: "An employee with this email already exists" },
      { status: 409 }
    );
  }

  // Uniqueness: employee code (HR-provided)
  const codeSnap = await adminDb
    .collection(COLLECTIONS.employees)
    .where("employeeCode", "==", input.employeeCode)
    .limit(1)
    .get();
  if (!codeSnap.empty) {
    return NextResponse.json(
      { success: false, error: "An employee with this employee code already exists" },
      { status: 409 }
    );
  }

  let authUser: { uid: string } | null = null;
  try {
    const existingAuth = await adminAuth.getUserByEmail(email);
    if (existingAuth) {
      return NextResponse.json(
        { success: false, error: "An authentication account already exists for this email" },
        { status: 409 }
      );
    }
  } catch {
    /* getUserByEmail throws if not found — expected */
  }

  const username = employeeCode;
  const temporaryPassword = generateTemporaryPassword();
  const employeeId = generateId("emp");
  const displayName = `${input.firstName} ${input.lastName}`.trim();

  try {
    const created = await adminAuth.createUser({
      email,
      password: temporaryPassword,
      displayName,
      emailVerified: false,
      disabled: false,
    });
    authUser = { uid: created.uid };

    await adminAuth.setCustomUserClaims(created.uid, {
      role: "employee",
      employeeId,
      username,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create authentication account",
      },
      { status: 500 }
    );
  }

  const createdStage = getStageDefinition("created");
  const verifyStage = getStageDefinition("hr_verification");

  const employee: Employee = {
    id: employeeId,
    employeeCode,
    username,
    userId: authUser!.uid,
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.mobile,
    mobile: input.mobile,
    dateOfJoining: input.dateOfJoining,
    designation: input.designation,
    departmentId: input.departmentId,
    ...(input.departmentName ? { departmentName: input.departmentName } : {}),
    ...(input.reportingManagerId ? { reportingManagerId: input.reportingManagerId } : {}),
    ...(input.reportingManagerName ? { reportingManagerName: input.reportingManagerName } : {}),
    employmentType: input.employmentType,
    status: verifyStage.employeeStatus,
    lifecycleStage: "hr_verification",
    lifecycleProgress: getProgressForStage("hr_verification"),
    inductionStatus: "not_started",
    onboardingStatus: "pending_first_login",
    accountProvisionedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: auth.uid,
  };

  const userProfile: UserProfile = {
    id: authUser!.uid,
    uid: authUser!.uid,
    email,
    username,
    displayName,
    role: "employee",
    employeeId,
    departmentId: input.departmentId,
    phone: input.mobile,
    isActive: true,
    mustChangePassword: true,
    mustUpdateProfile: true,
    mustAcceptPolicies: true,
    createdAt: now,
    updatedAt: now,
    createdBy: auth.uid,
  };

  const batch = adminDb.batch();
  batch.set(adminDb.collection(COLLECTIONS.employees).doc(employeeId), employee);
  batch.set(adminDb.collection(COLLECTIONS.users).doc(authUser!.uid), userProfile);

  const createdEventId = generateId("lev");
  batch.set(adminDb.collection(COLLECTIONS.lifecycleEvents).doc(createdEventId), {
    id: createdEventId,
    employeeId,
    stage: "created",
    title: createdStage.label,
    description: `Employee ${employeeCode} onboarded — Auth account provisioned`,
    status: "completed",
    actorId: auth.uid,
    actorName: auth.profile.displayName || auth.email,
    actorRole: auth.role,
    completedAt: now,
    createdAt: now,
    metadata: { username, employmentType: input.employmentType },
  });

  const verifyEventId = generateId("lev");
  batch.set(adminDb.collection(COLLECTIONS.lifecycleEvents).doc(verifyEventId), {
    id: verifyEventId,
    employeeId,
    stage: "hr_verification",
    title: verifyStage.label,
    description: "Awaiting HR verification",
    status: "current",
    actorId: auth.uid,
    actorName: auth.profile.displayName || auth.email,
    actorRole: auth.role,
    createdAt: now,
  });

  const approvalId = generateId("appr");
  batch.set(adminDb.collection(COLLECTIONS.lifecycleApprovals).doc(approvalId), {
    id: approvalId,
    employeeId,
    type: "hr_verification",
    title: "HR Verification required",
    description: `Verify documents for ${displayName}`,
    status: "pending",
    requestedBy: auth.uid,
    requestedByName: auth.profile.displayName || auth.email,
    requestedAt: now,
    stage: "hr_verification",
  });

  const notifId = generateId("notif");
  batch.set(adminDb.collection(COLLECTIONS.notifications).doc(notifId), {
    id: notifId,
    userId: auth.uid,
    type: "system",
    title: "Employee onboarded",
    message: `${displayName} (${employeeCode}) account created. Share login credentials securely.`,
    link: `/dashboard/employees/${employeeId}`,
    isRead: false,
    createdAt: now,
    updatedAt: now,
    createdBy: auth.uid,
  });

  const activityId = generateId("act");
  batch.set(adminDb.collection(COLLECTIONS.activityLogs).doc(activityId), {
    id: activityId,
    userId: auth.uid,
    employeeId,
    verb: "account_provisioned",
    summary: `Provisioned Auth account for ${employeeCode}`,
    resourceType: "employee",
    resourceId: employeeId,
    metadata: { username, email },
    createdAt: now,
  });

  try {
    await batch.commit();
  } catch (err) {
    // Roll back Auth user if Firestore write fails
    try {
      await adminAuth.deleteUser(authUser!.uid);
    } catch {
      /* best effort */
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to save employee profile",
      },
      { status: 500 }
    );
  }

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`;
  let emailResult: { sent: boolean; reason?: string } = {
    sent: false,
    reason: "Email skipped by request",
  };

  if (input.emailCredentials) {
    emailResult = await sendOnboardingCredentialsEmail({
      to: auth.email,
      hrName: auth.profile.displayName || auth.email,
      employeeName: displayName,
      employeeCode,
      username,
      temporaryPassword,
      email,
      loginUrl,
      designation: input.designation,
      departmentName: input.departmentName,
    });

    if (emailResult.sent) {
      await adminDb.collection(COLLECTIONS.employees).doc(employeeId).update({
        credentialsEmailedAt: now,
        credentialsEmailedTo: auth.email,
        updatedAt: now,
      });

      const emailActId = generateId("act");
      await adminDb.collection(COLLECTIONS.activityLogs).doc(emailActId).set({
        id: emailActId,
        userId: auth.uid,
        employeeId,
        verb: "credentials_emailed",
        summary: `Credentials emailed to ${auth.email}`,
        resourceType: "employee",
        resourceId: employeeId,
        createdAt: now,
      });
    }
  }

  await writeAuditLog({
    actorId: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "create",
    resourceType: "employee",
    resourceId: employeeId,
    description: `Onboarded employee ${employeeCode} with Auth account`,
    after: {
      employeeCode,
      username,
      email,
      employmentType: input.employmentType,
      departmentId: input.departmentId,
      userId: authUser!.uid,
      credentialsEmailed: emailResult.sent,
    },
    ipAddress: ip,
    userAgent: ua,
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        employee,
        credentials: {
          username,
          employeeCode,
          email,
          temporaryPassword,
          loginUrl,
          /** Shown once — never stored */
          oneTime: true,
        },
        email: emailResult,
      },
    },
    { status: 201 }
  );
}
