import "server-only";

import { COLLECTIONS } from "@/lib/firebase/client";
import { adminDb } from "@/lib/firebase/admin";
import {
  computeLockoutAfterFailure,
  isCurrentlyLocked,
  lockoutDocId,
  normalizeEmail,
  remainingLockMs,
} from "@/lib/auth/lockout";
import { LOCKOUT_POLICY } from "@/constants/auth";
import type { LoginLockout } from "@/types";
import { generateId } from "@/lib/utils";

/** In-memory fallback when Admin SDK / Firestore is unavailable (local demo). */
const memoryLockouts = new Map<string, LoginLockout>();

function adminReady(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

async function getLockout(email: string): Promise<LoginLockout | null> {
  const id = lockoutDocId(email);
  if (!adminReady()) {
    return memoryLockouts.get(id) ?? null;
  }
  try {
    const snap = await adminDb.collection(COLLECTIONS.loginLockouts).doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as LoginLockout;
  } catch {
    return memoryLockouts.get(id) ?? null;
  }
}

async function saveLockout(lock: LoginLockout): Promise<void> {
  memoryLockouts.set(lock.id, lock);
  if (!adminReady()) return;
  try {
    await adminDb.collection(COLLECTIONS.loginLockouts).doc(lock.id).set(lock, { merge: true });
  } catch {
    /* memory fallback already set */
  }
}

export interface LockoutCheckResult {
  allowed: boolean;
  failedAttempts: number;
  remainingAttempts: number;
  lockedUntil: string | null;
  remainingMs: number;
  message?: string;
}

export async function checkLoginAllowed(email: string): Promise<LockoutCheckResult> {
  const lock = await getLockout(email);
  if (isCurrentlyLocked(lock)) {
    const remainingMs = remainingLockMs(lock);
    return {
      allowed: false,
      failedAttempts: lock?.failedAttempts ?? LOCKOUT_POLICY.maxFailedAttempts,
      remainingAttempts: 0,
      lockedUntil: lock?.lockedUntil ?? null,
      remainingMs,
      message: `Account temporarily locked due to multiple failed sign-in attempts. Try again in ${Math.ceil(remainingMs / 60000)} minute(s).`,
    };
  }

  const failedAttempts = lock?.failedAttempts ?? 0;
  return {
    allowed: true,
    failedAttempts,
    remainingAttempts: Math.max(0, LOCKOUT_POLICY.maxFailedAttempts - failedAttempts),
    lockedUntil: null,
    remainingMs: 0,
  };
}

export async function recordLoginFailure(email: string): Promise<LockoutCheckResult> {
  const id = lockoutDocId(email);
  const existing = await getLockout(email);
  const patch = computeLockoutAfterFailure(existing);
  const lock: LoginLockout = {
    id,
    emailNormalized: normalizeEmail(email),
    lastSuccessAt: existing?.lastSuccessAt,
    ...patch,
  };
  await saveLockout(lock);

  const locked = isCurrentlyLocked(lock);
  return {
    allowed: !locked,
    failedAttempts: lock.failedAttempts,
    remainingAttempts: Math.max(0, LOCKOUT_POLICY.maxFailedAttempts - lock.failedAttempts),
    lockedUntil: lock.lockedUntil,
    remainingMs: remainingLockMs(lock),
    message: locked
      ? `Account locked after ${LOCKOUT_POLICY.maxFailedAttempts} failed attempts. Try again later.`
      : `Invalid credentials. ${Math.max(0, LOCKOUT_POLICY.maxFailedAttempts - lock.failedAttempts)} attempt(s) remaining.`,
  };
}

export async function recordLoginSuccess(email: string): Promise<void> {
  const id = lockoutDocId(email);
  const now = new Date().toISOString();
  const lock: LoginLockout = {
    id,
    emailNormalized: normalizeEmail(email),
    failedAttempts: 0,
    lockedUntil: null,
    lastSuccessAt: now,
    updatedAt: now,
  };
  await saveLockout(lock);
}

export async function writeLoginAudit(params: {
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: "login" | "logout";
  description: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}) {
  if (!adminReady()) return;
  try {
    const auditId = generateId("audit");
    await adminDb.collection(COLLECTIONS.auditLogs).doc(auditId).set({
      id: auditId,
      timestamp: new Date().toISOString(),
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      action: params.action,
      resourceType: "session",
      resourceId: params.actorId,
      description: params.description,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      after: { success: params.success },
    });
  } catch {
    /* non-blocking */
  }
}

export async function writeActivityLogServer(params: {
  userId: string;
  employeeId?: string;
  verb: string;
  summary: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, string>;
}) {
  if (!adminReady()) return;
  try {
    const id = generateId("act");
    await adminDb.collection(COLLECTIONS.activityLogs).doc(id).set({
      id,
      ...params,
      createdAt: new Date().toISOString(),
    });
  } catch {
    /* non-blocking */
  }
}

export async function updateUserLastLogin(uid: string, ip?: string) {
  if (!adminReady()) return;
  try {
    const now = new Date().toISOString();
    await adminDb.collection(COLLECTIONS.users).doc(uid).set(
      {
        lastLoginAt: now,
        lastLoginIp: ip ?? null,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch {
    /* non-blocking */
  }
}
