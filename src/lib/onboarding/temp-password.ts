import { randomBytes } from "crypto";
import { PASSWORD_POLICY } from "@/constants/auth";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%&*";

/**
 * Cryptographically strong temporary password that always satisfies PASSWORD_POLICY.
 * Never log or persist — return once to HR for secure handoff.
 */
export function generateTemporaryPassword(length = 14): string {
  const min = Math.max(length, PASSWORD_POLICY.minLength);
  const pool = UPPER + LOWER + DIGITS + SPECIAL;
  const required = [
    UPPER[randomBytes(1)[0]! % UPPER.length]!,
    LOWER[randomBytes(1)[0]! % LOWER.length]!,
    DIGITS[randomBytes(1)[0]! % DIGITS.length]!,
    SPECIAL[randomBytes(1)[0]! % SPECIAL.length]!,
  ];

  const rest: string[] = [];
  const bytes = randomBytes(min - required.length);
  for (let i = 0; i < bytes.length; i++) {
    rest.push(pool[bytes[i]! % pool.length]!);
  }

  const chars = [...required, ...rest];
  // Fisher–Yates shuffle with crypto bytes
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
