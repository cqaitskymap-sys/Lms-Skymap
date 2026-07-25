import { PASSWORD_POLICY } from "@/constants/auth";

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: "weak" | "fair" | "strong";
}

export function validatePassword(
  password: string,
  options?: { email?: string }
): PasswordValidationResult {
  const errors: string[] = [];
  const { minLength, maxLength, requireUppercase, requireLowercase, requireDigit, requireSpecial, specialPattern } =
    PASSWORD_POLICY;

  if (!password || password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }
  if (password.length > maxLength) {
    errors.push(`Password must be at most ${maxLength} characters`);
  }
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Include at least one uppercase letter");
  }
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Include at least one lowercase letter");
  }
  if (requireDigit && !/[0-9]/.test(password)) {
    errors.push("Include at least one number");
  }
  if (requireSpecial && !specialPattern.test(password)) {
    errors.push("Include at least one special character");
  }

  if (options?.email) {
    const local = options.email.split("@")[0]?.toLowerCase();
    if (local && local.length >= 3 && password.toLowerCase().includes(local)) {
      errors.push("Password must not contain your email username");
    }
  }

  let score = 0;
  if (password.length >= minLength) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (specialPattern.test(password)) score += 1;

  const strength: PasswordValidationResult["strength"] =
    score >= 4 ? "strong" : score >= 3 ? "fair" : "weak";

  return { valid: errors.length === 0, errors, strength };
}
