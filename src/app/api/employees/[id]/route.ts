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
  loginEmailFromEmployeeCode,
  updateEmployeeProfileSchema,
} from "@/lib/auth/onboarding-schemas";
import { getActiveDepartmentOrThrow } from "@/lib/departments/validate";
import type { Employee } from "@/types";

async function deleteQueryBatch(
  collectionName: string,
  field: string,
  value: string
): Promise<number> {
  let total = 0;
  while (true) {
    const snap = await adminDb
      .collection(collectionName)
      .where(field, "==", value)
      .limit(500)
      .get();
    if (snap.empty) return total;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 500) return total;
  }
}

/**
 * HR / Super Admin — correct profile fields after the employee is created.
 * Employee code stays the login username. Lifecycle stage is left unchanged.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminConfigured()) {
    return unauthorized(
      "Firebase Admin SDK is required to update employees. Configure service account credentials and restart the server.",
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
  if (!hasPermission(auth.role, "employees:write")) {
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

  const parsed = updateEmployeeProfileSchema.safeParse(raw);
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

  const input = { ...parsed.data, employmentType: "permanent" as const };
  const { id } = await context.params;
  const empRef = adminDb.collection(COLLECTIONS.employees).doc(id);
  const empSnap = await empRef.get();
  if (!empSnap.exists) {
    return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
  }

  const previousEmployee = empSnap.data() as Record<string, unknown>;
  const employee = { id: empSnap.id, ...previousEmployee } as Employee;
  const employeeCode = input.employeeCode;
  const email = loginEmailFromEmployeeCode(employeeCode);
  const contactEmail = input.email?.trim().toLowerCase() || "";
  const displayName = `${input.firstName} ${input.lastName}`.trim();
  const previousEmail = (employee.email || "").toLowerCase();
  const previousDisplayName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
  const emailChanged = email !== previousEmail;
  const displayNameChanged = displayName !== previousDisplayName;
  const codeChanged = employeeCode !== (employee.employeeCode || "").toUpperCase();

  let departmentName = employee.departmentName || input.departmentName || "";
  if (input.departmentId === employee.departmentId) {
    try {
      const dept = await getActiveDepartmentOrThrow(input.departmentId);
      departmentName = dept.name;
    } catch {
      // Keep the current assignment so a deactivated department does not block other edits.
    }
  } else {
    try {
      const dept = await getActiveDepartmentOrThrow(input.departmentId);
      departmentName = dept.name;
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : "Invalid department" },
        { status: 400 }
      );
    }
  }

  if (codeChanged) {
    const codeSnap = await adminDb
      .collection(COLLECTIONS.employees)
      .where("employeeCode", "==", employeeCode)
      .limit(1)
      .get();
    if (!codeSnap.empty && codeSnap.docs[0]!.id !== id) {
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
    if (!usernameSnap.empty && usernameSnap.docs[0]!.id !== employee.userId) {
      return NextResponse.json(
        { success: false, error: "An account with this username already exists" },
        { status: 409 }
      );
    }
  }

  if (emailChanged) {
    const emailSnap = await adminDb
      .collection(COLLECTIONS.employees)
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!emailSnap.empty && emailSnap.docs[0]!.id !== id) {
      return NextResponse.json(
        { success: false, error: "A login account for this employee code already exists" },
        { status: 409 }
      );
    }
    const userEmailSnap = await adminDb
      .collection(COLLECTIONS.users)
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!userEmailSnap.empty && userEmailSnap.docs[0]!.id !== employee.userId) {
      return NextResponse.json(
        { success: false, error: "A login account for this employee code already exists" },
        { status: 409 }
      );
    }
  }

  const now = new Date().toISOString();
  const profilePatch = {
    employeeCode,
    username: employeeCode,
    email,
    contactEmail,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.mobile || "",
    mobile: input.mobile || "",
    dateOfJoining: input.dateOfJoining,
    designation: input.designation,
    departmentId: input.departmentId,
    departmentName: departmentName || "",
    employmentType: input.employmentType,
    reportingManagerId: input.reportingManagerId || "",
    reportingManagerName: input.reportingManagerName || "",
    updatedAt: now,
    updatedBy: auth.uid,
  };

  const userRef = employee.userId
    ? adminDb.collection(COLLECTIONS.users).doc(employee.userId)
    : null;
  const previousUserSnap = userRef ? await userRef.get() : null;
  const previousUser = previousUserSnap?.exists ? previousUserSnap.data() : null;

  const batch = adminDb.batch();
  batch.update(empRef, profilePatch);
  if (userRef && previousUser) {
    batch.set(
      userRef,
      {
        email,
        username: employeeCode,
        displayName,
        departmentId: input.departmentId,
        phone: input.mobile || "",
        updatedAt: now,
        updatedBy: auth.uid,
      },
      { merge: true }
    );
  }

  const eventId = generateId("lev");
  const eventRef = adminDb.collection(COLLECTIONS.lifecycleEvents).doc(eventId);
  batch.set(eventRef, {
    id: eventId,
    employeeId: id,
    stage: employee.lifecycleStage || "created",
    title: "Profile updated",
    description: `Updated profile for ${displayName} (${employeeCode})`,
    status: "completed",
    actorId: auth.uid,
    actorName: auth.profile.displayName || auth.email,
    actorRole: auth.role,
    completedAt: now,
    createdAt: now,
    metadata: { kind: "profile_update" },
  });

  try {
    await batch.commit();
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to save employee profile",
      },
      { status: 500 }
    );
  }

  if (employee.userId && (emailChanged || displayNameChanged || codeChanged)) {
    const uid = employee.userId;
    let appliedAuth = false;
    let appliedClaims = false;
    let previousClaims: Record<string, unknown> | undefined;
    try {
      const authUpdates: { displayName?: string; email?: string } = {};
      if (displayNameChanged) authUpdates.displayName = displayName;
      if (emailChanged) authUpdates.email = email;
      if (Object.keys(authUpdates).length > 0) {
        await adminAuth.updateUser(uid, authUpdates);
        appliedAuth = true;
      }
      if (codeChanged) {
        const record = await adminAuth.getUser(uid);
        previousClaims = { ...(record.customClaims ?? {}) };
        await adminAuth.setCustomUserClaims(uid, {
          ...previousClaims,
          role: (record.customClaims?.role as string | undefined) ?? "employee",
          employeeId: id,
          username: employeeCode,
        });
        appliedClaims = true;
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "auth/user-not-found") {
        if (appliedAuth) {
          const rollback: { displayName?: string; email?: string } = {};
          if (displayNameChanged) rollback.displayName = previousDisplayName;
          if (emailChanged && previousEmail) rollback.email = previousEmail;
          if (Object.keys(rollback).length > 0) {
            await adminAuth.updateUser(uid, rollback).catch(() => undefined);
          }
        }
        if (appliedClaims && previousClaims) {
          await adminAuth.setCustomUserClaims(uid, previousClaims).catch(() => undefined);
        }
        await empRef.set(previousEmployee);
        if (userRef && previousUser) await userRef.set(previousUser);
        await eventRef.delete().catch(() => undefined);
        if (code === "auth/email-already-exists") {
          return NextResponse.json(
            { success: false, error: "A login account for this employee code already exists" },
            { status: 409 }
          );
        }
        return NextResponse.json(
          {
            success: false,
            error: err instanceof Error ? err.message : "Failed to update login account",
          },
          { status: 500 }
        );
      }
    }
  }

  const updated = { ...employee, ...profilePatch };
  try {
    await writeAuditLog({
      actorId: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "update",
      resourceType: "employee",
      resourceId: id,
      description: `Updated employee profile ${employeeCode}`,
      before: employee as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });
  } catch (err) {
    console.error("[employees] audit log failed", err);
  }

  return NextResponse.json({ success: true, data: updated });
}

/**
 * Super Admin — permanently remove employee, lifecycle records, linked Auth user,
 * and related assignments.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminConfigured()) {
    return unauthorized(
      "Firebase Admin SDK is required to delete employees. Configure service account credentials and restart the server.",
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

  if (auth.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden: Super Admin only" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const empRef = adminDb.collection(COLLECTIONS.employees).doc(id);
  const empSnap = await empRef.get();
  if (!empSnap.exists) {
    return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
  }

  const employee = { id: empSnap.id, ...empSnap.data() } as Employee;
  const userId = employee.userId;

  await deleteQueryBatch(COLLECTIONS.lifecycleEvents, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.lifecycleApprovals, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.inductionAssignments, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.trainingAssignments, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.jobDescriptions, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.tni, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.certificates, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.ojtAssignments, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.assessmentAttempts, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.examResults, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.sopAcknowledgements, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.sopViews, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.sopReadingProgress, "employeeId", id);
  if (userId) {
    await deleteQueryBatch(COLLECTIONS.notifications, "userId", userId);
    await deleteQueryBatch(COLLECTIONS.policyAcceptances, "userId", userId);
  }

  await empRef.delete();

  if (userId) {
    try {
      await adminDb.collection(COLLECTIONS.users).doc(userId).delete();
    } catch {
      /* best-effort */
    }
    try {
      await adminAuth.deleteUser(userId);
    } catch {
      /* user may already be removed from Auth */
    }
  }

  await writeAuditLog({
    actorId: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "delete",
    resourceType: "employee",
    resourceId: id,
    description: `Deleted employee ${employee.employeeCode}${userId ? " and linked Auth account" : ""}`,
    before: employee as unknown as Record<string, unknown>,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  return NextResponse.json({ success: true, message: "Employee deleted" });
}
