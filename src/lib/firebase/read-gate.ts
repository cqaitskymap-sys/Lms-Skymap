/**
 * After Firestore returns resource-exhausted, further client reads only
 * add more 429s. Hold them for a cooldown and let callers use cached data.
 */

const COOLDOWN_MS = 15 * 60 * 1000;

let blockedUntil = 0;

export function firestoreReadsBlocked(): boolean {
  return Date.now() < blockedUntil;
}

export function isResourceExhausted(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  return code === "resource-exhausted" || /quota exceeded|too many requests/i.test(String(err));
}

export function noteFirestoreExhausted(err: unknown): boolean {
  if (!isResourceExhausted(err)) return false;
  blockedUntil = Date.now() + COOLDOWN_MS;
  return true;
}

export class FirestoreQuotaError extends Error {
  constructor() {
    super(
      "Firestore read quota is exhausted. Cloud reads are paused for 15 minutes; the screen keeps the last loaded data."
    );
    this.name = "FirestoreQuotaError";
  }
}

export function assertFirestoreReadsOpen(): void {
  if (firestoreReadsBlocked()) throw new FirestoreQuotaError();
}
