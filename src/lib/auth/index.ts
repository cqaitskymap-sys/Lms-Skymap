export { validatePassword } from "@/lib/auth/password-policy";
export {
  loginSchema,
  forgotPasswordSchema,
  changePasswordSchema,
  profileUpdateSchema,
} from "@/lib/auth/schemas";
export { matchRouteRule, DASHBOARD_ROUTE_RULES } from "@/lib/auth/route-permissions";
export {
  normalizeEmail,
  lockoutDocId,
  isCurrentlyLocked,
  formatLockDuration,
} from "@/lib/auth/lockout";
