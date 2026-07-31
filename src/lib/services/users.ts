/**
 * Super Admin — staff user provisioning & directory.
 */

import { auth } from "@/lib/firebase/client";
import {
  isDemoMode,
  DEMO_USERS,
  getDemoAdminUsers,
  saveDemoAdminUser,
  updateDemoAdminUser,
  removeDemoAdminUser,
  findDemoAdminUserByUid,
} from "@/lib/demo/data";
import type { CreateAdminUserInput, UpdateAdminUserInput } from "@/lib/auth/user-admin-schemas";
import type { UserProfile } from "@/types";
import { generateId } from "@/lib/utils";

export interface StaffCredentials {
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  oneTime: boolean;
}

export interface CreateStaffUserResult {
  user: UserProfile;
  credentials: StaffCredentials;
}

const STAFF_ROLES: UserProfile["role"][] = [
  "super_admin",
  "hr",
  "qa",
  "department_head",
  "trainer",
];

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in");
  const token = await user.getIdToken(true);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function localTempPassword(): string {
  const part = Math.random().toString(36).slice(2, 8);
  return `Temp@${part}A1!`;
}

function demoStaffUsers(): UserProfile[] {
  const merged = { ...DEMO_USERS, ...getDemoAdminUsers() };
  return Object.values(merged)
    .map((entry) => entry.profile)
    .filter((p) => STAFF_ROLES.includes(p.role))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function listStaffUsers(): Promise<UserProfile[]> {
  if (isDemoMode()) {
    return demoStaffUsers();
  }

  const res = await fetch("/api/users", { headers: await authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "Failed to load users");
  }
  return json.users as UserProfile[];
}

export async function createStaffUser(
  input: CreateAdminUserInput
): Promise<CreateStaffUserResult> {
  if (isDemoMode()) {
    const normalized = input.email.toLowerCase();
    const merged = { ...DEMO_USERS, ...getDemoAdminUsers() };
    if (merged[normalized]) {
      throw new Error("A user with this email already exists");
    }

    const temporaryPassword = localTempPassword();
    const uid = generateId("user");
    const now = new Date().toISOString();

    const profile: UserProfile = {
      id: uid,
      uid,
      email: normalized,
      displayName: input.displayName,
      role: input.role,
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.departmentId ? { departmentId: input.departmentId } : {}),
      isActive: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
      createdBy: "super_admin",
    };

    saveDemoAdminUser(normalized, { password: temporaryPassword, profile });

    return {
      user: profile,
      credentials: {
        email: normalized,
        temporaryPassword,
        loginUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/login`,
        oneTime: true,
      },
    };
  }

  const res = await fetch("/api/users", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = json.details
      ? Object.values(json.details as Record<string, string[]>)
          .flat()
          .join("; ")
      : "";
    throw new Error(details || json.error || "Failed to create user");
  }

  return { user: json.user, credentials: json.credentials };
}

export async function updateStaffUser(
  userId: string,
  input: UpdateAdminUserInput
): Promise<UserProfile> {
  if (isDemoMode()) {
    const entry = findDemoAdminUserByUid(userId);
    if (!entry) {
      throw new Error("Demo user not found or cannot edit built-in demo accounts from UI");
    }

    const [email, data] = entry;
    const now = new Date().toISOString();
    const updated: UserProfile = {
      ...data.profile,
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || undefined } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.departmentId !== undefined
        ? { departmentId: input.departmentId || undefined }
        : {}),
      updatedAt: now,
    };

    updateDemoAdminUser(email, { ...data, profile: updated });
    return updated;
  }

  const res = await fetch(`/api/users/${userId}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = json.details
      ? Object.values(json.details as Record<string, string[]>)
          .flat()
          .join("; ")
      : "";
    throw new Error(details || json.error || "Failed to update user");
  }
  return json.user as UserProfile;
}

export async function resetStaffPassword(userId: string): Promise<StaffCredentials> {
  if (isDemoMode()) {
    const entry = findDemoAdminUserByUid(userId);
    if (!entry) {
      throw new Error("Demo user not found or cannot reset built-in demo account passwords");
    }

    const [email, data] = entry;
    const temporaryPassword = localTempPassword();
    updateDemoAdminUser(email, { password: temporaryPassword, profile: data.profile });

    return {
      email: data.profile.email,
      temporaryPassword,
      loginUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/login`,
      oneTime: true,
    };
  }

  const res = await fetch(`/api/users/${userId}/reset-password`, {
    method: "POST",
    headers: await authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "Failed to reset password");
  }
  return json.credentials as StaffCredentials;
}

export async function deleteStaffUser(userId: string): Promise<void> {
  if (isDemoMode()) {
    const entry = findDemoAdminUserByUid(userId);
    if (!entry) {
      throw new Error("Demo user not found or cannot delete built-in demo accounts");
    }
    removeDemoAdminUser(entry[0]);
    return;
  }

  const res = await fetch(`/api/users/${userId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "Failed to delete user");
  }
}
