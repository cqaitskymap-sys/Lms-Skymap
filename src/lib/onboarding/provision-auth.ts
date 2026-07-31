import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { allocateEmployeeCode } from "@/lib/onboarding/employee-code";
import type { Employee, UserProfile } from "@/types";

function isUserNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "auth/user-not-found"
  );
}

/**
 * Ensure an employee has a linked Firebase Auth account.
 * Creates or links an existing Auth user, updates Firestore profiles, and returns the uid.
 */
export async function ensureEmployeeAuthAccount(
  employee: Employee,
  temporaryPassword: string,
  actorUid: string
): Promise<{ uid: string; username: string; employeeCode: string; employee: Employee }> {
  if (!employee.email) {
    throw new Error("Employee email is required to provision authentication");
  }

  const employeeCode = employee.employeeCode || (await allocateEmployeeCode());
  const username = employee.username || employeeCode;
  const displayName = `${employee.firstName} ${employee.lastName}`.trim();
  const now = new Date().toISOString();

  let uid: string;

  try {
    const existing = await adminAuth.getUserByEmail(employee.email);
    uid = existing.uid;

    const profileSnap = await adminDb.collection(COLLECTIONS.users).doc(uid).get();
    const linkedEmployeeId = profileSnap.data()?.employeeId as string | undefined;
    if (linkedEmployeeId && linkedEmployeeId !== employee.id) {
      throw new Error(
        "An authentication account for this email is already linked to another employee"
      );
    }

    await adminAuth.updateUser(uid, {
      password: temporaryPassword,
      displayName: displayName || existing.displayName,
    });
  } catch (err) {
    if (!isUserNotFound(err)) {
      throw err;
    }

    const created = await adminAuth.createUser({
      email: employee.email,
      password: temporaryPassword,
      displayName,
      emailVerified: false,
      disabled: false,
    });
    uid = created.uid;
  }

  await adminAuth.setCustomUserClaims(uid, {
    role: "employee",
    employeeId: employee.id,
    username,
  });

  const userProfile: UserProfile = {
    id: uid,
    uid,
    email: employee.email,
    username,
    displayName,
    role: "employee",
    employeeId: employee.id,
    departmentId: employee.departmentId,
    phone: employee.mobile || employee.phone,
    isActive: true,
    mustChangePassword: true,
    mustUpdateProfile: true,
    mustAcceptPolicies: true,
    createdAt: now,
    updatedAt: now,
    createdBy: actorUid,
  };

  await adminDb.collection(COLLECTIONS.users).doc(uid).set(userProfile, { merge: true });

  const employeeUpdates: Partial<Employee> = {
    userId: uid,
    username,
    employeeCode,
    accountProvisionedAt: employee.accountProvisionedAt || now,
    onboardingStatus: "pending_first_login",
    updatedAt: now,
  };

  await adminDb.collection(COLLECTIONS.employees).doc(employee.id).update(employeeUpdates);

  return {
    uid,
    username,
    employeeCode,
    employee: { ...employee, ...employeeUpdates },
  };
}
