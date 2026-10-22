import "server-only";

import { COLLECTIONS } from "@/lib/firebase/client";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
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

/** Per-instance rate limit (best-effort on serverless). */
const rateBuckets = new Map<string, number[]>();

export function consumeRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    rateBuckets.set(key, hits);
    return false;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  return true;
}

export async function userExistsForEmail(email: string): Promise<boolean> {
  if (!isAdminConfigured()) return true;
  try {
    const normalized = normalizeEmail(email);
    const snap = await adminDb
      .collection(COLLECTIONS.users)
      .where("email", "==", normalized)
      .limit(1)
      .get();
    return !snap.empty;
  } catch {
    // Unknown lookup must not create lockout rows for every typed address.
    return false;
  }
}

async function getLockout(email: string): Promise<LoginLockout | null> {
  const id = lockoutDocId(email);
  if (!isAdminConfigured()) {
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

/** Firestore rejects undefined. Optional timestamps are omitted so the first failure still persists. */
function lockoutForWrite(lock: LoginLockout): LoginLockout {
  const next: LoginLockout = {
    id: lock.id,
    emailNormalized: lock.emailNormalized,
    failedAttempts: lock.failedAttempts,
    lockedUntil: lock.lockedUntil ?? null,
    updatedAt: lock.updatedAt,
  };
  if (lock.lastFailedAt) next.lastFailedAt = lock.lastFailedAt;
  if (lock.lastSuccessAt) next.lastSuccessAt = lock.lastSuccessAt;
  return next;
}

function failureLock(id: string, email: string, existing: LoginLockout | null): LoginLockout {
  const patch = computeLockoutAfterFailure(existing);
  return lockoutForWrite({
    id,
    emailNormalized: normalizeEmail(email),
    failedAttempts: patch.failedAttempts,
    lockedUntil: patch.lockedUntil,
    lastFailedAt: patch.lastFailedAt,
    updatedAt: patch.updatedAt,
    ...(existing?.lastSuccessAt ? { lastSuccessAt: existing.lastSuccessAt } : {}),
  });
}

function lockoutResult(lock: LoginLockout): LockoutCheckResult {
  const locked = isCurrentlyLocked(lock);
  return {
    allowed: !locked,
    failedAttempts: lock.failedAttempts,
    remainingAttempts: locked
      ? 0
      : Math.max(0, LOCKOUT_POLICY.maxFailedAttempts - lock.failedAttempts),
    lockedUntil: lock.lockedUntil,
    remainingMs: remainingLockMs(lock),
    message: locked
      ? `Account locked after ${LOCKOUT_POLICY.maxFailedAttempts} failed attempts. Try again later.`
      : `Invalid credentials. ${Math.max(0, LOCKOUT_POLICY.maxFailedAttempts - lock.failedAttempts)} attempt(s) remaining.`,
  };
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
  const startedAt = new Date().toISOString();

  if (!isAdminConfigured()) {
    const lock = failureLock(id, email, memoryLockouts.get(id) ?? null);
    memoryLockouts.set(id, lock);
    return lockoutResult(lock);
  }

  const ref = adminDb.collection(COLLECTIONS.loginLockouts).doc(id);
  let lock: LoginLockout | null = null;
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists ? ({ id: snap.id, ...snap.data() } as LoginLockout) : null;
      if (existing?.lastSuccessAt && existing.lastSuccessAt > startedAt) {
        lock = existing;
        return;
      }
      const next = failureLock(id, email, existing);
      lock = next;
      tx.set(ref, next, { merge: true });
    });
  } catch {
    lock = failureLock(id, email, memoryLockouts.get(id) ?? null);
  }

  const stored = lock ?? failureLock(id, email, null);
  memoryLockouts.set(stored.id, stored);
  return lockoutResult(stored);
}

export async function recordLoginSuccess(email: string): Promise<void> {
  const id = lockoutDocId(email);
  const now = new Date().toISOString();
  const lock = lockoutForWrite({
    id,
    emailNormalized: normalizeEmail(email),
    failedAttempts: 0,
    lockedUntil: null,
    lastSuccessAt: now,
    updatedAt: now,
  });
  memoryLockouts.set(id, lock);
  if (!isAdminConfigured()) return;

  try {
    const ref = adminDb.collection(COLLECTIONS.loginLockouts).doc(id);
    await adminDb.runTransaction(async (tx) => {
      tx.set(ref, lock, { merge: true });
    });
  } catch {
    /* memory fallback already set */
  }
}

export async function writeLoginAudit(params: {
  actorId: string;
  actorEmail: string;
  actorName?: string;
  actorEmployeeCode?: string;
  actorRole: string;
  action: "login" | "logout";
  description: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}) {
  if (!isAdminConfigured()) return;
  try {
    let actorName = params.actorName?.trim() || "";
    let actorEmployeeCode = params.actorEmployeeCode?.trim() || "";
    if ((!actorName || !actorEmployeeCode) && params.actorId) {
      const snap = await adminDb.collection(COLLECTIONS.users).doc(params.actorId).get();
      if (snap.exists) {
        const data = snap.data() || {};
        actorName = actorName || String(data.displayName || "").trim();
        actorEmployeeCode = actorEmployeeCode || String(data.username || "").trim();
      }
    }
    const auditId = generateId("audit");
    await adminDb.collection(COLLECTIONS.auditLogs).doc(auditId).set({
      id: auditId,
      timestamp: new Date().toISOString(),
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      ...(actorName ? { actorName } : {}),
      ...(actorEmployeeCode ? { actorEmployeeCode } : {}),
      actorRole: params.actorRole,
      action: params.action,
      resourceType: "session",
      resourceId: params.actorId,
      description: params.description,
      ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
      ...(params.userAgent ? { userAgent: params.userAgent } : {}),
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
  if (!isAdminConfigured()) return;
  try {
    const id = generateId("act");
    await adminDb.collection(COLLECTIONS.activityLogs).doc(id).set({
      id,
      userId: params.userId,
      verb: params.verb,
      summary: params.summary,
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
      ...(params.userAgent ? { userAgent: params.userAgent } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
      createdAt: new Date().toISOString(),
    });
  } catch {
    /* non-blocking */
  }
}

export async function updateUserLastLogin(uid: string, ip?: string) {
  if (!isAdminConfigured()) return;
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
