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
    .min(1, "Employee name is required")
    .max(60, "Employee name is too long"),
  /** Remainder after the first word. Empty when the hire has a single name. */
  lastName: z.string().trim().max(80, "Employee name is too long"),
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
    .max(20)
    .refine((v) => v === "" || /^[+]?[\d\s()-]{7,20}$/.test(v), {
      message: "Enter a valid mobile number",
    }),
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

/** Profile fields HR can correct after the employee account already exists. */
export const updateEmployeeProfileSchema = onboardEmployeeSchema.omit({
  emailCredentials: true,
});

/** Production download URLs are https. The Storage emulator serves http on localhost. */
function isAllowedStorageUrl(value: string): boolean {
  if (value.startsWith("https://")) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

export const legacyUploadedFileSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  storagePath: z.string().trim().min(1).max(400),
  downloadUrl: z.string().trim().url().max(4000),
  fileSize: z.number().int().positive().max(15 * 1024 * 1024),
  mimeType: z.string().trim().min(1).max(160),
});

/** Employee who was onboarded, with JD and TNI, before this LMS existed. */
export const legacyEmployeeSchema = onboardEmployeeSchema
  .omit({
    reportingManagerId: true,
    reportingManagerName: true,
    emailCredentials: true,
    employmentType: true,
  })
  .extend({
    jdNo: z.string().trim().max(40).optional().or(z.literal("")),
    jdDocument: legacyUploadedFileSchema,
    tniDocument: legacyUploadedFileSchema,
  })
  .superRefine((data, ctx) => {
    const expect = (kind: "jd" | "tni", path: string, field: "jdDocument" | "tniDocument") => {
      const prefix = `legacy-records/${data.employeeCode}/${kind}/`;
      if (!path.startsWith(prefix)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Upload the ${kind.toUpperCase()} file again before import`,
          path: [field, "storagePath"],
        });
      }
    };
    expect("jd", data.jdDocument.storagePath, "jdDocument");
    expect("tni", data.tniDocument.storagePath, "tniDocument");
    for (const field of ["jdDocument", "tniDocument"] as const) {
      if (!isAllowedStorageUrl(data[field].downloadUrl)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Document link must be a secure storage URL",
          path: [field, "downloadUrl"],
        });
      }
    }
  });

export type OnboardEmployeeInput = z.infer<typeof onboardEmployeeSchema>;
export type LegacyEmployeeInput = z.infer<typeof legacyEmployeeSchema>;
export type UpdateEmployeeProfileInput = z.infer<typeof updateEmployeeProfileSchema>;
export type CompleteOnboardingProfileInput = z.infer<typeof completeOnboardingProfileSchema>;
export type AcceptPoliciesInput = z.infer<typeof acceptPoliciesSchema>;

/**
 * Firebase Auth needs an email, but the login ID is the employee code.
 * The Auth address is always derived from that code, never from the mailbox HR types.
 */
export function loginEmailFromEmployeeCode(employeeCode: string): string {
  return `${employeeCode.trim().toLowerCase()}@pharma.local`;
}

/** @deprecated Login no longer follows a typed mailbox. Use loginEmailFromEmployeeCode. */
export function resolveOnboardingEmail(email: string | undefined, employeeCode: string): string {
  const trimmed = email?.trim();
  if (trimmed) return trimmed.toLowerCase();
  return loginEmailFromEmployeeCode(employeeCode);
}

/** Address used only for mail. Empty when the stored email is the code-based login. */
export function employeeContactEmail(employee: {
  email?: string;
  contactEmail?: string;
}): string {
  const contact = employee.contactEmail?.trim();
  if (contact) return contact.toLowerCase();
  const email = employee.email?.trim().toLowerCase() || "";
  if (!email || email.endsWith("@pharma.local")) return "";
  return email;
}
