import type { UserRole } from "@/types";
import type { Permission } from "@/lib/rbac/permissions";

export interface RouteAccessRule {
  /** Path prefix under /dashboard */
  pattern: string | RegExp;
  roles?: UserRole[];
  permissions?: Permission[];
  /** If true, any authenticated active user may access */
  anyAuthenticated?: boolean;
}

/**
 * Declarative RBAC for dashboard routes.
 * First matching rule wins. More specific patterns should be listed first.
 */
export const DASHBOARD_ROUTE_RULES: RouteAccessRule[] = [
  { pattern: "/dashboard/settings", anyAuthenticated: true },
  { pattern: "/dashboard/onboarding", anyAuthenticated: true },
  { pattern: "/dashboard/notifications", anyAuthenticated: true },
  { pattern: "/dashboard/unauthorized", anyAuthenticated: true },

  { pattern: "/dashboard/employees", permissions: ["employees:read"] },
  { pattern: "/dashboard/induction", roles: ["super_admin", "hr", "employee"] },
  { pattern: "/dashboard/departments", permissions: ["departments:read"] },
  { pattern: "/dashboard/jd", permissions: ["jd:read"] },
  { pattern: "/dashboard/tni", permissions: ["tni:read"] },
  { pattern: "/dashboard/sops", permissions: ["sops:read"] },
  { pattern: "/dashboard/trainers", permissions: ["trainers:read"] },
  { pattern: "/dashboard/training", permissions: ["training:read"] },
  { pattern: "/dashboard/matrix", permissions: ["reports:read"] },
  { pattern: "/dashboard/questions", permissions: ["questions:read"] },
  { pattern: "/dashboard/exams", permissions: ["exams:read", "assessments:take"] },
  { pattern: "/dashboard/certificates", permissions: ["certificates:read"] },
  { pattern: "/dashboard/reports", permissions: ["reports:read"] },
  { pattern: "/dashboard/audit", permissions: ["audit:read"] },
  { pattern: "/dashboard/hr", permissions: ["dashboard:hr"] },
  { pattern: "/dashboard/qa", permissions: ["dashboard:qa"] },
  { pattern: "/dashboard/department", permissions: ["dashboard:dept"] },
  { pattern: "/dashboard/trainer", permissions: ["dashboard:trainer"] },
  { pattern: "/dashboard/employee", permissions: ["dashboard:employee"] },
  { pattern: "/dashboard", anyAuthenticated: true },
];

export function matchRouteRule(pathname: string): RouteAccessRule | null {
  const normalized = pathname.replace(/\/$/, "") || "/dashboard";
  for (const rule of DASHBOARD_ROUTE_RULES) {
    if (typeof rule.pattern === "string") {
      if (normalized === rule.pattern || normalized.startsWith(`${rule.pattern}/`)) {
        return rule;
      }
    } else if (rule.pattern.test(normalized)) {
      return rule;
    }
  }
  return null;
}
