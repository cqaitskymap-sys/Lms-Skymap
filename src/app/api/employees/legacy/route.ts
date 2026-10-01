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
import { stripUndefined } from "@/lib/services/helpers";
import {
  legacyEmployeeSchema,
  loginEmailFromEmployeeCode,
} from "@/lib/auth/onboarding-schemas";
import { getActiveDepartmentOrThrow } from "@/lib/departments/validate";
import { generateTemporaryPassword } from "@/lib/onboarding/temp-password";
import { getProgressForStage, getStageDefinition, STAGE_ORDER } from "@/lib/lifecycle/stages";
import type { Employee, InductionSignedPaper, JobDescription, TrainingNeedIdentification, UserProfile } from "@/types";

function asPaper(
  file: {
    fileName: string;
    storagePath: string;
    downloadUrl: string;
    fileSize: number;
    mimeType: string;
  },
  actorId: string,
  now: string
): InductionSignedPaper {
  return {
    fileName: file.fileName,
    storagePath: file.storagePath,
    downloadUrl: file.downloadUrl,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    uploadedAt: now,
    uploadedBy: actorId,
  };
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return unauthorized(
      "Firebase Admin SDK is required to create Auth accounts. Configure Admin credentials, then restart the dev server.",
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

  const parsed = legacyEmployeeSchema.safeParse(raw);
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
  const employeeCode = input.employeeCode;
  const email = loginEmailFromEmployeeCode(employeeCode);
  const contactEmail = input.email?.trim().toLowerCase() || "";
  const jdNo = (input.jdNo || `JD-${employeeCode}`).trim().toUpperCase();

  let departmentName = "";
  try {
    const dept = await getActiveDepartmentOrThrow(input.departmentId);
    departmentName = dept.name;
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Invalid department" },
      { status: 400 }
    );
  }

  const codeSnap = await adminDb
    .collection(COLLECTIONS.employees)
    .where("employeeCode", "==", employeeCode)
    .limit(1)
    .get();
  if (!codeSnap.empty) {
    return NextResponse.json(
      { success: false, error: "An employee with this employee code already exists" },
      { status: 409 }
    );
  }

  const usernameSnap = await adminDb
    .collection(COLLECTIONS.users)
    .where("username", "==", employeeCode)
    .limit(1)
    .get();
  if (!usernameSnap.empty) {
    return NextResponse.json(
      { success: false, error: "An account with this username already exists" },
      { status: 409 }
    );
  }

  const jdSnap = await adminDb
    .collection(COLLECTIONS.jobDescriptions)
    .where("jdNo", "==", jdNo)
    .limit(1)
    .get();
  if (!jdSnap.empty) {
    return NextResponse.json(
      { success: false, error: `JD number "${jdNo}" already exists` },
      { status: 409 }
    );
  }

  try {
    const existingAuth = await adminAuth.getUserByEmail(email);
    if (existingAuth) {
      return NextResponse.json(
        { success: false, error: "A login account for this employee code already exists" },
        { status: 409 }
      );
    }
  } catch {
    /* getUserByEmail throws when the account does not exist */
  }

  const temporaryPassword = generateTemporaryPassword();
  const employeeId = generateId("emp");
  const jdId = generateId("jd");
  const tniId = generateId("tni");
  const displayName = `${input.firstName} ${input.lastName}`.trim();
  const jdPaper = asPaper(input.jdDocument, auth.uid, now);
  const tniPaper = asPaper(input.tniDocument, auth.uid, now);

  let authUser: { uid: string } | null = null;
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
      username: employeeCode,
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

  const stage = getStageDefinition("tni_created");
  const employee: Employee = {
    id: employeeId,
    employeeCode,
    username: employeeCode,
    userId: authUser.uid,
    email,
    ...(contactEmail ? { contactEmail } : {}),
    firstName: input.firstName,
    lastName: input.lastName,
    ...(input.mobile ? { phone: input.mobile, mobile: input.mobile } : {}),
    dateOfJoining: input.dateOfJoining,
    designation: input.designation,
    departmentId: input.departmentId,
    departmentName,
    employmentType: "permanent",
    status: stage.employeeStatus,
    lifecycleStage: "tni_created",
    lifecycleProgress: getProgressForStage("tni_created"),
    inductionStatus: "passed",
    inductionCompletedAt: now,
    verifiedAt: now,
    verifiedBy: auth.uid,
    handedOverAt: now,
    handedOverBy: auth.uid,
    jdId,
    tniId,
    recordSource: "pre_system",
    legacyJdDocument: jdPaper,
    legacyTniDocument: tniPaper,
    onboardingStatus: "pending_first_login",
    accountProvisionedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: auth.uid,
  };

  const userProfile: UserProfile = {
    id: authUser.uid,
    uid: authUser.uid,
    email,
    username: employeeCode,
    displayName,
    role: "employee",
    employeeId,
    departmentId: input.departmentId,
    ...(input.mobile ? { phone: input.mobile } : {}),
    isActive: true,
    mustChangePassword: true,
    mustUpdateProfile: true,
    mustAcceptPolicies: true,
    createdAt: now,
    updatedAt: now,
    createdBy: auth.uid,
  };

  const jd: JobDescription = {
    id: jdId,
    jdNo,
    employeeId,
    departmentId: input.departmentId,
    title: input.designation,
    version: 1,
    responsibilities: [
      "Historical Job Description uploaded from records created before this LMS.",
    ],
    qualifications: [],
    skills: [],
    status: "approved",
    approvedBy: auth.uid,
    approvedAt: now,
    effectiveFrom: input.dateOfJoining,
    sourceDocument: jdPaper,
    importedFrom: "pre_system",
    createdAt: now,
    updatedAt: now,
    createdBy: auth.uid,
  };

  const tni: TrainingNeedIdentification = {
    id: tniId,
    employeeId,
    departmentId: input.departmentId,
    jdId,
    version: 1,
    needs: [
      {
        id: generateId("need"),
        topic: "Pre-system Training Need Identification",
        priority: "medium",
        rationale: "TNI document uploaded from records created before this LMS.",
        status: "completed",
      },
    ],
    status: "approved",
    approvedBy: auth.uid,
    approvedAt: now,
    sourceDocument: tniPaper,
    importedFrom: "pre_system",
    createdAt: now,
    updatedAt: now,
    createdBy: auth.uid,
  };

  const batch = adminDb.batch();
  batch.set(adminDb.collection(COLLECTIONS.employees).doc(employeeId), stripUndefined(employee));
  batch.set(adminDb.collection(COLLECTIONS.users).doc(authUser.uid), stripUndefined(userProfile));
  batch.set(adminDb.collection(COLLECTIONS.jobDescriptions).doc(jdId), stripUndefined(jd));
  batch.set(adminDb.collection(COLLECTIONS.tni).doc(tniId), stripUndefined(tni));

  const throughTni = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf("tni_created") + 1);
  for (const lifecycleStage of throughTni) {
    const def = getStageDefinition(lifecycleStage);
    const eventId = generateId("lev");
    const current = lifecycleStage === "tni_created";
    batch.set(adminDb.collection(COLLECTIONS.lifecycleEvents).doc(eventId), {
      id: eventId,
      employeeId,
      stage: lifecycleStage,
      title: def.label,
      description: current
        ? "Pre-system employee imported with existing JD and TNI files"
        : "Recorded from onboarding completed before this LMS",
      status: current ? "current" : "completed",
      actorId: auth.uid,
      actorName: auth.profile.displayName || auth.email,
      actorRole: auth.role,
      ...(current ? {} : { completedAt: now }),
      createdAt: now,
      metadata: { recordSource: "pre_system", jdId, tniId },
    });
  }

  const activityId = generateId("act");
  batch.set(adminDb.collection(COLLECTIONS.activityLogs).doc(activityId), {
    id: activityId,
    userId: auth.uid,
    employeeId,
    verb: "legacy_employee_imported",
    summary: `Imported pre-system employee ${employeeCode} with JD and TNI files`,
    resourceType: "employee",
    resourceId: employeeId,
    metadata: { username: employeeCode, jdId, tniId, jdNo },
    createdAt: now,
  });

  try {
    await batch.commit();
  } catch (err) {
    try {
      await adminAuth.deleteUser(authUser.uid);
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
  await writeAuditLog({
    actorId: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "create",
    resourceType: "employee",
    resourceId: employeeId,
    description: `Imported pre-system employee ${employeeCode} with JD ${jdNo} and TNI files`,
    after: {
      employeeCode,
      departmentId: input.departmentId,
      jdId,
      tniId,
      recordSource: "pre_system",
    },
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        employeeId,
        employeeCode,
        username: employeeCode,
        temporaryPassword,
        loginUrl,
        jdId,
        tniId,
      },
    },
    { status: 201 }
  );
}
