import { createHash } from "crypto";
import { LOCKOUT_POLICY } from "@/constants/auth";
import type { LoginLockout } from "@/types";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Stable doc id — avoids storing raw email as document ID with special chars. */
export function lockoutDocId(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 32);
}

export function isCurrentlyLocked(lock: Pick<LoginLockout, "lockedUntil"> | null | undefined): boolean {
  if (!lock?.lockedUntil) return false;
  return new Date(lock.lockedUntil).getTime() > Date.now();
}

export function remainingLockMs(lock: Pick<LoginLockout, "lockedUntil"> | null | undefined): number {
  if (!lock?.lockedUntil) return 0;
  return Math.max(0, new Date(lock.lockedUntil).getTime() - Date.now());
}

export function computeLockoutAfterFailure(
  existing: LoginLockout | null
): Pick<LoginLockout, "failedAttempts" | "lockedUntil" | "lastFailedAt" | "updatedAt"> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let failedAttempts = existing?.failedAttempts ?? 0;
  const lastFailed = existing?.lastFailedAt ? new Date(existing.lastFailedAt).getTime() : 0;

  // Reset counter if outside attempt window and not currently locked
  if (
    !isCurrentlyLocked(existing) &&
    lastFailed &&
    now - lastFailed > LOCKOUT_POLICY.attemptWindowMs
  ) {
    failedAttempts = 0;
  }

  // If lock expired, start fresh
  if (existing?.lockedUntil && !isCurrentlyLocked(existing)) {
    failedAttempts = 0;
  }

  failedAttempts += 1;

  let lockedUntil: string | null = existing?.lockedUntil && isCurrentlyLocked(existing)
    ? existing.lockedUntil
    : null;

  if (failedAttempts >= LOCKOUT_POLICY.maxFailedAttempts) {
    lockedUntil = new Date(now + LOCKOUT_POLICY.lockDurationMs).toISOString();
  }

  return {
    failedAttempts,
    lockedUntil,
    lastFailedAt: nowIso,
    updatedAt: nowIso,
  };
}

export function formatLockDuration(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  return mins <= 1 ? "1 minute" : `${mins} minutes`;
}
