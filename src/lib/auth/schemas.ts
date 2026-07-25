import { z } from "zod";
import { PASSWORD_POLICY } from "@/constants/auth";
import { validatePassword } from "@/lib/auth/password-policy";

const passwordSchema = z
  .string()
  .min(PASSWORD_POLICY.minLength, `Min ${PASSWORD_POLICY.minLength} characters`)
  .max(PASSWORD_POLICY.maxLength);

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Username or email is required")
    .max(120, "Identifier is too long"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .superRefine((data, ctx) => {
    const result = validatePassword(data.newPassword);
    if (!result.valid) {
      result.errors.forEach((msg) => {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ["newPassword"] });
      });
    }
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
    if (data.currentPassword && data.currentPassword === data.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New password must be different from current password",
        path: ["newPassword"],
      });
    }
  });

export const profileUpdateSchema = z.object({
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name is too long"),
  phone: z
    .string()
    .max(20)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[+]?[\d\s()-]{7,20}$/.test(v), "Enter a valid phone number"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
