import { z } from "zod";

/** Roles Super Admin can provision via User Management (not employee / super_admin). */
export const PROVISIONABLE_ROLES = ["hr", "qa", "department_head", "trainer"] as const;

export type ProvisionableRole = (typeof PROVISIONABLE_ROLES)[number];

export const createAdminUserSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Display name is required")
      .max(80, "Display name is too long"),
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .transform((v) => v.toLowerCase()),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[+]?[\d\s()-]{0,20}$/, "Enter a valid phone number")
      .optional()
      .or(z.literal("")),
    role: z.enum(PROVISIONABLE_ROLES, { message: "Select a role" }),
    departmentId: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => data.role !== "department_head" || Boolean(data.departmentId),
    { message: "Department is required for Department Head", path: ["departmentId"] }
  );

export const updateAdminUserSchema = z
  .object({
    displayName: z.string().trim().min(2, "Display name is required").max(80).optional(),
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
  })
  .refine(
    (data) => data.role !== "department_head" || Boolean(data.departmentId),
    { message: "Department is required for Department Head", path: ["departmentId"] }
  );

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
