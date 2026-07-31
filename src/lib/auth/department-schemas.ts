import { z } from "zod";

export const departmentCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, "Code must be at least 2 characters")
  .max(12, "Code is too long")
  .regex(/^[A-Z0-9]+$/, "Use uppercase letters and numbers only (e.g. QA, IPQA)");

export const createDepartmentSchema = z.object({
  code: departmentCodeSchema,
  name: z.string().trim().min(2, "Name is required").max(100),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

export const updateDepartmentSchema = z.object({
  code: departmentCodeSchema.optional(),
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
