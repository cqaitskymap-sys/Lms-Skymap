import { z } from "zod";
import { loginEmailFromEmployeeCode } from "@/lib/auth/onboarding-schemas";
import { APP_MODULES } from "@/lib/rbac/modules";

/** Roles an Admin can provision via User Management (not employee). */
export const PROVISIONABLE_ROLES = [
  "super_admin",
  "hr",
  "qa",
  "department_head",
  "trainer",
] as const;

export type ProvisionableRole = (typeof PROVISIONABLE_ROLES)[number];

const appModuleSchema = z.enum(APP_MODULES);

/** Optional mailbox. Empty is allowed. Not unique across staff. */
const workEmailSchema = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: "Enter a valid work email",
  });

/** Staff login ID — same rules as employee code; used as username at sign-in. */
export const staffUsernameSchema = z
  .string()
  .trim()
  .min(1, "Staff ID is required")
  .max(30, "Staff ID is too long")
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
    "Use letters, numbers, hyphens, or underscores only"
  )
  .transform((v) => v.toUpperCase());

export const createAdminUserSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Display name is required")
      .max(80, "Display name is too long"),
    /** Login ID — staff signs in with this + temporary password */
    username: staffUsernameSchema,
    email: workEmailSchema,
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[+]?[\d\s()-]{0,20}$/, "Enter a valid phone number")
      .optional()
      .or(z.literal("")),
    role: z.enum(PROVISIONABLE_ROLES, { message: "Select a role" }),
    departmentId: z.string().optional().or(z.literal("")),
    /** Optional modules; Dashboard / Notifications / Settings are always granted on save. */
    allowedModules: z.array(appModuleSchema).default([]),
  })
  .refine(
    (data) => data.role !== "department_head" || Boolean(data.departmentId),
    { message: "Department is required for Department Head", path: ["departmentId"] }
  );

/**
 * Firebase Auth address. Always derived from the staff ID so the same work
 * mailbox can be stored on more than one staff account.
 */
export function resolveStaffAuthEmail(username: string): string {
  return loginEmailFromEmployeeCode(username);
}

/** Optional mailbox. Not unique — several staff may share one address. */
export function staffContactEmail(email: string | undefined): string {
  return email?.trim().toLowerCase() || "";
}

export const updateAdminUserSchema = z
  .object({
    displayName: z.string().trim().min(2, "Display name is required").max(80).optional(),
    email: workEmailSchema.optional(),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[+]?[\d\s()-]{0,20}$/, "Enter a valid phone number")
      .optional()
      .or(z.literal("")),
    isActive: z.boolean().optional(),
    role: z.enum(PROVISIONABLE_ROLES).optional(),
    departmentId: z.string().optional().or(z.literal("")),
    allowedModules: z.array(appModuleSchema).optional(),
  })
  .refine(
    (data) => data.role !== "department_head" || Boolean(data.departmentId),
    { message: "Department is required for Department Head", path: ["departmentId"] }
  );

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
