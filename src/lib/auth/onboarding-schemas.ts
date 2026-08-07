import { z } from "zod";

export const EMPLOYMENT_TYPES = [
  "permanent",
  "contract",
  "intern",
  "consultant",
  "temporary",
] as const;

export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES);

export const onboardEmployeeSchema = z.object({
  /** Org employee code — entered by HR (also used as login username) */
  employeeCode: z
    .string()
    .trim()
    .min(1, "Employee code is required")
    .max(30, "Employee code is too long")
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
      "Use letters, numbers, hyphens, or underscores only"
    )
    .transform((v) => v.toUpperCase()),
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(60, "First name is too long"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(60, "Last name is too long"),
  email: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Enter a valid work email",
    }),
  mobile: z
    .string()
    .trim()
    .min(7, "Enter a valid mobile number")
    .max(20)
    .regex(/^[+]?[\d\s()-]{7,20}$/, "Enter a valid mobile number"),
  departmentId: z.string().min(1, "Department is required"),
  departmentName: z.string().trim().optional(),
  designation: z.string().trim().min(2, "Designation is required").max(80),
  dateOfJoining: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format"),
  reportingManagerId: z.string().optional().or(z.literal("")),
  reportingManagerName: z.string().trim().optional().or(z.literal("")),
  employmentType: employmentTypeSchema,
  /** When true, attempt to email credentials to HR (and CC employee if configured) */
  emailCredentials: z.boolean().optional().default(true),
});

export const completeOnboardingPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current (temporary) password is required"),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(1),
});

export const completeOnboardingProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[+]?[\d\s()-]{7,20}$/.test(v), "Enter a valid phone number"),
  emergencyContact: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
});

export const acceptPoliciesSchema = z.object({
  policyIds: z.array(z.string()).min(1, "Accept all required policies"),
  version: z.string().min(1),
});

export const resolveLoginSchema = z.object({
  identifier: z.string().trim().min(1, "Username or email is required").max(120),
});

export type OnboardEmployeeInput = z.infer<typeof onboardEmployeeSchema>;
export type CompleteOnboardingProfileInput = z.infer<typeof completeOnboardingProfileSchema>;
export type AcceptPoliciesInput = z.infer<typeof acceptPoliciesSchema>;

/**
 * Firebase Auth requires an email. When HR leaves work email blank,
 * derive a stable login address from the employee code.
 */
export function resolveOnboardingEmail(email: string | undefined, employeeCode: string): string {
  const trimmed = email?.trim();
  if (trimmed) return trimmed.toLowerCase();
  return `${employeeCode.trim().toLowerCase()}@pharma.local`;
}
