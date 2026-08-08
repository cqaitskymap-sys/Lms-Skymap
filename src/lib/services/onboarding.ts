/**
 * Client helpers for Employee Onboarding (HR provisioning + first-login completion).
 */

import { auth } from "@/lib/firebase/client";
import { isDemoMode, DEMO_DEPARTMENTS } from "@/lib/demo/data";
import { createEmployeeWithLifecycle, type LifecycleActor } from "@/lib/services/lifecycle";
import type { OnboardEmployeeInput } from "@/lib/auth/onboarding-schemas";
import { resolveOnboardingEmail } from "@/lib/auth/onboarding-schemas";
import type { Employee, EmploymentType } from "@/types";
import { readLifecycleStore } from "@/lib/lifecycle/demo-store";

export interface OnboardingCredentials {
  username: string;
  employeeCode: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  oneTime: boolean;
}

export interface OnboardResult {
  employee: Employee;
  credentials: OnboardingCredentials;
  email: { sent: boolean; reason?: string };
}

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in");
  const token = await user.getIdToken(/* forceRefresh */ true);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function localTempPassword(): string {
  const part = Math.random().toString(36).slice(2, 8);
  return `Temp@${part}A1!`;
}

async function onboardLocally(
  input: OnboardEmployeeInput,
  actor: LifecycleActor,
  emailReason: string
): Promise<OnboardResult> {
  const employeeCode = input.employeeCode;
  const email = resolveOnboardingEmail(input.email, employeeCode);
  const existing = readLifecycleStore().employees;
  if (existing.some((e) => e.employeeCode.toUpperCase() === employeeCode)) {
    throw new Error("An employee with this employee code already exists");
  }
  if (existing.some((e) => e.email.toLowerCase() === email)) {
    throw new Error("An employee with this email already exists");
  }

  const temporaryPassword = localTempPassword();
  const dept = DEMO_DEPARTMENTS.find((d) => d.id === input.departmentId);

  const employee = await createEmployeeWithLifecycle(
    {
      employeeCode,
      username: employeeCode,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.mobile,
      mobile: input.mobile,
      designation: input.designation,
      departmentId: input.departmentId,
      dateOfJoining: input.dateOfJoining,
      employmentType: input.employmentType as EmploymentType,
      onboardingStatus: "pending_first_login",
      accountProvisionedAt: new Date().toISOString(),
      ...(input.departmentName || dept?.name
        ? { departmentName: input.departmentName || dept?.name }
        : {}),
      ...(input.reportingManagerId
        ? { reportingManagerId: input.reportingManagerId }
        : {}),
      ...(input.reportingManagerName
        ? { reportingManagerName: input.reportingManagerName }
        : {}),
    },
    actor
  );

  window.dispatchEvent(new Event("pharma-lifecycle-updated"));

  return {
    employee,
    credentials: {
      username: employeeCode,
      employeeCode,
      email,
      temporaryPassword,
      loginUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/login`,
      oneTime: true,
    },
    email: { sent: false, reason: emailReason },
  };
}

export async function onboardEmployee(
  input: OnboardEmployeeInput,
  actor: LifecycleActor
): Promise<OnboardResult> {
  if (isDemoMode()) {
    return onboardLocally(
      input,
      actor,
      "Demo mode — credentials shown on screen only (no Auth account)"
    );
  }

  if (!auth.currentUser) {
    throw new Error("You must be signed in to onboard employees");
  }

  const res = await fetch("/api/employees/onboard", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });

  const json = await res.json().catch(() => ({} as { success?: boolean; error?: string; data?: OnboardResult }));

  if (
    res.status === 503 ||
    (typeof json.error === "string" && json.error.includes("Admin SDK"))
  ) {
    throw new Error(
      json.error ||
        "Firebase Admin SDK is required to onboard employees. Configure Admin credentials."
    );
  }

  if (!res.ok || !json.success) {
    const details = json.details as Record<string, string[] | undefined> | undefined;
    if (details && typeof details === "object") {
      const first = Object.entries(details).find(([, msgs]) => msgs?.length);
      if (first) {
        const [field, msgs] = first;
        throw new Error(`${field}: ${msgs![0]}`);
      }
    }
    throw new Error(json.error || `Failed to onboard employee (${res.status})`);
  }
  window.dispatchEvent(new Event("pharma-lifecycle-updated"));
  return json.data as OnboardResult;
}

export async function reissueCredentials(
  employeeId: string,
  emailCredentials = true
): Promise<{
  credentials: OnboardingCredentials;
  email: OnboardResult["email"];
}> {
  if (isDemoMode()) {
    const emp = readLifecycleStore().employees.find((e) => e.id === employeeId);
    if (!emp) throw new Error("Employee not found");
    const temporaryPassword = localTempPassword();
    return {
      credentials: {
        username: emp.username || emp.employeeCode,
        employeeCode: emp.employeeCode,
        email: emp.email,
        temporaryPassword,
        loginUrl: `${window.location.origin}/login`,
        oneTime: true,
      },
      email: { sent: false, reason: "Demo / local mode" },
    };
  }

  if (!auth.currentUser) {
    throw new Error("You must be signed in to re-issue credentials");
  }

  const res = await fetch(`/api/employees/${employeeId}/credentials`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ emailCredentials }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to re-issue credentials");
  }
  return {
    credentials: json.data.credentials as OnboardingCredentials,
    email: json.data.email as OnboardResult["email"],
  };
}

export async function resolveLoginIdentifier(identifier: string): Promise<string> {
  const trimmed = identifier.trim();
  if (!trimmed) throw new Error("Username or email is required");

  // Already an email — use directly
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  if (isDemoMode()) {
    throw new Error("In demo mode, sign in with a demo email (e.g. hr@pharma.local).");
  }

  const code = trimmed.toUpperCase();

  // Prefer Admin API when available
  try {
    const res = await fetch("/api/auth/resolve-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: trimmed }),
    });
    const json = await res.json();

    if (res.status === 403) {
      throw new Error(json.error || "Account is deactivated");
    }

    if (json?.data?.resolved && typeof json.data.email === "string" && json.data.email.includes("@")) {
      return json.data.email.toLowerCase();
    }

    if (res.status === 404) {
      throw new Error(json.error || "No account found for that username");
    }
    // resolved:false → fall through to client Firestore
  } catch (err) {
    if (err instanceof Error && !err.message.includes("fetch")) {
      // Re-throw intentional errors; network errors fall through
      if (
        err.message.includes("deactivated") ||
        err.message.includes("No account") ||
        err.message.includes("demo mode")
      ) {
        throw err;
      }
    }
  }

  // Client Firestore lookup (works without Admin SDK)
  const { collection, query, where, getDocs, limit } = await import("firebase/firestore/lite");
  const { db, COLLECTIONS } = await import("@/lib/firebase/client");

  const userSnap = await getDocs(
    query(collection(db, COLLECTIONS.users), where("username", "==", code), limit(1))
  );
  if (!userSnap.empty) {
    const u = userSnap.docs[0]!.data();
    if (u.isActive === false) throw new Error("Account is deactivated. Contact HR.");
    if (typeof u.email === "string" && u.email.includes("@")) {
      return u.email.toLowerCase();
    }
  }

  const empSnap = await getDocs(
    query(collection(db, COLLECTIONS.employees), where("employeeCode", "==", code), limit(1))
  );
  if (!empSnap.empty) {
    const e = empSnap.docs[0]!.data();
    if (typeof e.email === "string" && e.email.includes("@")) {
      return e.email.toLowerCase();
    }
  }

  throw new Error(
    "No account found for that username. Sign in with your work email, or ask HR to provision your Auth account."
  );
}

export function needsFirstLoginOnboarding(profile: {
  mustChangePassword?: boolean;
  mustUpdateProfile?: boolean;
  mustAcceptPolicies?: boolean;
  onboardingCompletedAt?: string;
} | null): boolean {
  if (!profile) return false;
  if (profile.onboardingCompletedAt) return false;
  return Boolean(
    profile.mustChangePassword || profile.mustUpdateProfile || profile.mustAcceptPolicies
  );
}
