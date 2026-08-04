"use client";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db, COLLECTIONS } from "@/lib/firebase/client";
import { validatePassword } from "@/lib/auth/password-policy";
import { logActivity } from "@/lib/services/activity";
import { isDemoMode } from "@/lib/demo/data";

export async function requestPasswordReset(email: string): Promise<void> {
  if (isDemoMode()) {
    // Simulate success in demo — no Firebase mailer
    return;
  }
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function changeUserPassword(params: {
  currentPassword: string;
  newPassword: string;
  email: string;
  userId: string;
}): Promise<void> {
  const policy = validatePassword(params.newPassword, { email: params.email });
  if (!policy.valid) {
    throw new Error(policy.errors[0] || "Password does not meet policy");
  }

  if (isDemoMode()) {
    throw new Error("Password change is not available in demo mode");
  }

  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("You must be signed in to change your password");
  }

  const credential = EmailAuthProvider.credential(user.email, params.currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, params.newPassword);

  const now = new Date().toISOString();
  await updateDoc(doc(db, COLLECTIONS.users, params.userId), {
    mustChangePassword: false,
    passwordChangedAt: now,
    updatedAt: now,
  });

  // Password change counts as recent auth — refresh server session cookie
  await refreshServerSession(true);

  await logActivity({
    userId: params.userId,
    verb: "password_changed",
    summary: "Password changed successfully",
  });
}

export async function updateUserProfile(params: {
  userId: string;
  displayName: string;
  phone?: string;
}): Promise<void> {
  if (isDemoMode()) {
    return;
  }

  const now = new Date().toISOString();
  const payload: Record<string, string | boolean> = {
    displayName: params.displayName.trim(),
    updatedAt: now,
  };
  if (params.phone !== undefined) {
    payload.phone = params.phone.trim();
  }

  await updateDoc(doc(db, COLLECTIONS.users, params.userId), payload);

  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: params.displayName.trim() });
  }

  await logActivity({
    userId: params.userId,
    verb: "profile_updated",
    summary: "Updated profile details",
  });
}

export async function establishSession(idToken: string): Promise<{
  ok: boolean;
  status: number;
  error?: string;
}> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };
  return {
    ok: res.ok && data.success !== false,
    status: res.status,
    error: data.error,
  };
}

/**
 * Create/refresh the httpOnly session cookie using a fresh ID token.
 * Safe to call after login or password change. Ignores expected failures
 * when Firebase rejects createSessionCookie for non-recent sign-ins.
 */
export async function refreshServerSession(force = true): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const token = await user.getIdToken(force);
    const result = await establishSession(token);
    return result.ok;
  } catch {
    return false;
  }
}

export async function clearSession(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
}

export async function precheckLogin(email: string): Promise<{
  allowed: boolean;
  message?: string;
  remainingAttempts?: number;
  remainingMs?: number;
}> {
  const res = await fetch("/api/auth/precheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { allowed: true }; // fail open only if API down — Firebase still authenticates
  }
  return data;
}

export async function reportLoginFailure(email: string): Promise<{
  message?: string;
  lockedUntil?: string | null;
  remainingAttempts?: number;
}> {
  const res = await fetch("/api/auth/failure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return res.json();
}
