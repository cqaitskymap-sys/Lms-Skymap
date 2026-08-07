/**
 * App modules — sidebar entries assignable per staff user.
 * Role still gates capability; allowedModules further restricts which modules appear & open.
 */

import type { UserRole } from "@/types";

export const APP_MODULES = [
  "dashboard",
  "employees",
  "employees_new",
  "induction",
  "departments",
  "jd",
  "tni",
  "sops",
  "trainers",
  "training",
  "matrix",
  "questions",
  "exams",
  "certificates",
  "reports",
  "notifications",
  "audit",
  "users",
  "settings",
] as const;

export type AppModule = (typeof APP_MODULES)[number];

export interface AppModuleDef {
  id: AppModule;
  title: string;
  href: string;
  roles: UserRole[];
  /** Always available; not shown as optional in User Management picker */
  alwaysOn?: boolean;
  /** Super Admin only — never assignable to provisioned staff */
  superAdminOnly?: boolean;
}

export const APP_MODULE_DEFS: AppModuleDef[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    href: "/dashboard",
    roles: ["super_admin", "hr", "qa", "department_head", "trainer", "employee"],
    alwaysOn: true,
  },
  {
    id: "employees",
    title: "Employees",
    href: "/dashboard/employees",
    roles: ["super_admin", "hr", "department_head", "qa"],
  },
  {
    id: "employees_new",
    title: "Onboard employee",
    href: "/dashboard/employees/new",
    roles: ["super_admin", "hr"],
  },
  {
    id: "induction",
    title: "Induction",
    href: "/dashboard/induction",
    roles: ["super_admin", "hr", "employee"],
  },
  {
    id: "departments",
    title: "Departments",
    href: "/dashboard/departments",
    roles: ["super_admin", "hr", "qa"],
  },
  {
    id: "jd",
    title: "Job Descriptions",
    href: "/dashboard/jd",
    roles: ["super_admin", "department_head", "employee", "hr"],
  },
  {
    id: "tni",
    title: "TNI",
    href: "/dashboard/tni",
    roles: ["super_admin", "department_head", "hr"],
  },
  {
    id: "sops",
    title: "SOPs",
    href: "/dashboard/sops",
    roles: ["super_admin", "qa", "department_head", "trainer", "employee"],
  },
  {
    id: "trainers",
    title: "Trainers",
    href: "/dashboard/trainers",
    roles: ["super_admin", "department_head", "hr", "qa"],
  },
  {
    id: "training",
    title: "Training",
    href: "/dashboard/training",
    roles: ["super_admin", "department_head", "trainer", "employee", "hr", "qa"],
  },
  {
    id: "matrix",
    title: "Training Matrix",
    href: "/dashboard/matrix",
    roles: ["super_admin", "qa", "department_head", "hr"],
  },
  {
    id: "questions",
    title: "Question Bank",
    href: "/dashboard/questions",
    roles: ["super_admin", "qa", "hr"],
  },
  {
    id: "exams",
    title: "Assessments",
    href: "/dashboard/exams",
    roles: ["super_admin", "qa", "hr", "employee"],
  },
  {
    id: "certificates",
    title: "Certificates",
    href: "/dashboard/certificates",
    roles: ["super_admin", "hr", "qa", "department_head", "employee", "trainer"],
  },
  {
    id: "reports",
    title: "Reports",
    href: "/dashboard/reports",
    roles: ["super_admin", "hr", "qa", "department_head"],
  },
  {
    id: "notifications",
    title: "Notifications",
    href: "/dashboard/notifications",
    roles: ["super_admin", "hr", "qa", "department_head", "trainer", "employee"],
    alwaysOn: true,
  },
  {
    id: "audit",
    title: "Audit Trail",
    href: "/dashboard/audit",
    roles: ["super_admin", "hr", "qa"],
  },
  {
    id: "users",
    title: "User Management",
    href: "/dashboard/users",
    roles: ["super_admin"],
    superAdminOnly: true,
  },
  {
    id: "settings",
    title: "Settings",
    href: "/dashboard/settings",
    roles: ["super_admin", "hr", "qa", "department_head", "trainer", "employee"],
    alwaysOn: true,
  },
];

const MODULE_SET = new Set<string>(APP_MODULES);

export function isAppModule(value: string): value is AppModule {
  return MODULE_SET.has(value);
}

/** Modules a role may be granted (excludes super-admin-only). */
export function modulesForRole(role: UserRole): AppModuleDef[] {
  return APP_MODULE_DEFS.filter(
    (m) => m.roles.includes(role) && !m.superAdminOnly
  );
}

/** Optional modules shown in User Management checkboxes for a role. */
export function selectableModulesForRole(role: UserRole): AppModuleDef[] {
  return modulesForRole(role).filter((m) => !m.alwaysOn);
}

/** Default grant when creating a user: all role modules. */
export function defaultAllowedModules(role: UserRole): AppModule[] {
  return modulesForRole(role).map((m) => m.id);
}

/** Ensure always-on modules stay present; drop unknown / not-for-role ids. */
export function normalizeAllowedModules(
  role: UserRole,
  modules: string[] | undefined | null
): AppModule[] {
  const allowed = new Set(modulesForRole(role).map((m) => m.id));
  const always = modulesForRole(role)
    .filter((m) => m.alwaysOn)
    .map((m) => m.id);

  const selected = (modules ?? [])
    .filter((id): id is AppModule => isAppModule(id) && allowed.has(id));

  const merged = new Set<AppModule>([...always, ...selected]);
  return APP_MODULE_DEFS.map((m) => m.id).filter((id) => merged.has(id));
}

/**
 * Missing/undefined allowedModules = legacy users → full role access.
 * super_admin always has full access.
 */
export function effectiveAllowedModules(
  role: UserRole,
  allowedModules: string[] | undefined | null
): AppModule[] | "all" {
  if (role === "super_admin") return "all";
  if (allowedModules == null) return "all";
  return normalizeAllowedModules(role, allowedModules);
}

export function canAccessModule(
  role: UserRole,
  allowedModules: string[] | undefined | null,
  moduleId: AppModule
): boolean {
  const effective = effectiveAllowedModules(role, allowedModules);
  if (effective === "all") {
    const def = APP_MODULE_DEFS.find((m) => m.id === moduleId);
    return Boolean(def?.roles.includes(role));
  }
  return effective.includes(moduleId);
}

/** Longest href match wins (so /employees/new beats /employees). */
export function moduleIdForPath(pathname: string): AppModule | null {
  const normalized = pathname.replace(/\/$/, "") || "/dashboard";

  // Role home dashboards count as Dashboard
  if (
    normalized === "/dashboard" ||
    normalized.startsWith("/dashboard/hr") ||
    normalized.startsWith("/dashboard/qa") ||
    normalized.startsWith("/dashboard/department") ||
    normalized.startsWith("/dashboard/trainer") ||
    normalized.startsWith("/dashboard/employee") ||
    normalized.startsWith("/dashboard/onboarding") ||
    normalized.startsWith("/dashboard/unauthorized")
  ) {
    return "dashboard";
  }

  const sorted = [...APP_MODULE_DEFS].sort((a, b) => b.href.length - a.href.length);
  for (const mod of sorted) {
    if (mod.href === "/dashboard") continue;
    if (normalized === mod.href || normalized.startsWith(`${mod.href}/`)) {
      return mod.id;
    }
  }
  return null;
}

export function canAccessPath(
  role: UserRole,
  allowedModules: string[] | undefined | null,
  pathname: string
): boolean {
  const moduleId = moduleIdForPath(pathname);
  if (!moduleId) return true;
  return canAccessModule(role, allowedModules, moduleId);
}

export function moduleTitle(id: AppModule): string {
  return APP_MODULE_DEFS.find((m) => m.id === id)?.title ?? id;
}
