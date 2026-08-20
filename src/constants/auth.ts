/**
 * Authentication & session security constants for PharmaLMS.
 */

export const AUTH_COOKIE_NAME = "__session";

/** Session cookie lifetime when "Remember password" is checked (5 days). */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

/** Session cookie lifetime when "Remember password" is off (same browser session, max 12h). */
export const SESSION_TEMPORARY_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Idle timeout for client-side warning / soft logout (30 minutes). */
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** How often to refresh the ID token / extend session (55 minutes). */
export const SESSION_REFRESH_INTERVAL_MS = 55 * 60 * 1000;

export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  specialPattern: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/,
} as const;

export const LOCKOUT_POLICY = {
  /** Failed attempts before lock. */
  maxFailedAttempts: 5,
  /** Lock duration after threshold reached. */
  lockDurationMs: 15 * 60 * 1000,
  /** Window in which failures accumulate (then counter resets). */
  attemptWindowMs: 30 * 60 * 1000,
} as const;

export const PASSWORD_POLICY_HINT =
  "At least 8 characters, with uppercase, lowercase, a number, and a special character.";
