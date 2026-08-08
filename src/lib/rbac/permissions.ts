/**
 * Role-Based Access Control — permissions matrix for PharmaLMS
 */

import type { UserRole } from "@/types";

export type Permission =
  | "users:read"
  | "users:write"
  | "users:delete"
  | "employees:read"
  | "employees:write"
  | "employees:delete"
  | "employees:handover"
  | "employees:onboard"
  | "employees:email_credentials"
  | "induction:read"
  | "induction:write"
  | "induction:assign"
  | "induction:delete"
  | "departments:read"
  | "departments:write"
  | "departments:delete"
  | "jd:read"
  | "jd:write"
  | "jd:approve"
  | "jd:delete"
  | "tni:read"
  | "tni:write"
  | "tni:approve"
  | "tni:delete"
  | "sops:read"
  | "sops:write"
  | "sops:approve"
  | "sops:assign"
  | "sops:delete"
  | "trainers:read"
  | "trainers:write"
  | "trainers:delete"
  | "training:read"
  | "training:write"
  | "training:conduct"
  | "training:attend"
  | "training:delete"
  | "assessments:read"
  | "assessments:write"
  | "assessments:take"
  | "assessments:delete"
  | "questions:read"
  | "questions:write"
  | "questions:delete"
  | "exams:read"
  | "exams:write"
  | "exams:delete"
  | "certificates:read"
  | "certificates:issue"
  | "certificates:revoke"
  | "certificates:delete"
  | "reports:read"
  | "reports:export"
  | "reports:delete"
  | "notifications:read"
  | "notifications:delete"
  | "audit:read"
  | "audit:delete"
  | "lifecycle:delete"
  | "dashboard:admin"
  | "dashboard:hr"
  | "dashboard:qa"
  | "dashboard:dept"
  | "dashboard:trainer"
  | "dashboard:employee"
  | "settings:write";

const ALL_PERMISSIONS: Permission[] = [
  "users:read",
  "users:write",
  "users:delete",
  "employees:read",
  "employees:write",
  "employees:delete",
  "employees:handover",
  "employees:onboard",
  "employees:email_credentials",
  "induction:read",
  "induction:write",
  "induction:assign",
  "induction:delete",
  "departments:read",
  "departments:write",
  "departments:delete",
  "jd:read",
  "jd:write",
  "jd:approve",
  "jd:delete",
  "tni:read",
  "tni:write",
  "tni:approve",
  "tni:delete",
  "sops:read",
  "sops:write",
  "sops:approve",
  "sops:assign",
  "sops:delete",
  "trainers:read",
  "trainers:write",
  "trainers:delete",
  "training:read",
  "training:write",
  "training:conduct",
  "training:attend",
  "training:delete",
  "assessments:read",
  "assessments:write",
  "assessments:take",
  "assessments:delete",
  "questions:read",
  "questions:write",
  "questions:delete",
  "exams:read",
  "exams:write",
  "exams:delete",
  "certificates:read",
  "certificates:issue",
  "certificates:revoke",
  "certificates:delete",
  "reports:read",
  "reports:export",
  "reports:delete",
  "notifications:read",
  "notifications:delete",
  "audit:read",
  "audit:delete",
  "lifecycle:delete",
  "dashboard:admin",
  "dashboard:hr",
  "dashboard:qa",
  "dashboard:dept",
  "dashboard:trainer",
  "dashboard:employee",
  "settings:write",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Super Admin has every permission — also short-circuited in hasPermission()
  super_admin: ALL_PERMISSIONS,
  hr: [
    "employees:read",
    "employees:write",
    "employees:handover",
    "employees:onboard",
    "employees:email_credentials",
    "induction:read",
    "induction:write",
    "induction:assign",
    "departments:read",
    "departments:write",
    "jd:read",
    "tni:read",
    "trainers:read",
    "assessments:read",
    "assessments:write",
    "questions:read",
    "questions:write",
    "exams:read",
    "exams:write",
    "certificates:read",
    "certificates:issue",
    "reports:read",
    "reports:export",
    "notifications:read",
    "audit:read",
    "dashboard:hr",
    "training:read",
    "settings:write",
  ],
  qa: [
    "sops:read",
    "sops:write",
    "sops:approve",
    "sops:assign",
    "departments:read",
    "employees:read",
    "training:read",
    "trainers:read",
    "assessments:read",
    "questions:read",
    "questions:write",
    "exams:read",
    "exams:write",
    "certificates:read",
    "certificates:issue",
    "certificates:revoke",
    "reports:read",
    "reports:export",
    "notifications:read",
    "audit:read",
    "dashboard:qa",
    "settings:write",
  ],
  department_head: [
    "employees:read",
    "departments:read",
    "jd:read",
    "jd:write",
    "jd:approve",
    "tni:read",
    "tni:write",
    "tni:approve",
    "sops:read",
    "sops:assign",
    "trainers:read",
    "training:read",
    "training:write",
    "assessments:read",
    "certificates:read",
    "reports:read",
    "reports:export",
    "notifications:read",
    "dashboard:dept",
    "settings:write",
  ],
  trainer: [
    "employees:read",
    "departments:read",
    "sops:read",
    "training:read",
    "training:conduct",
    "trainers:read",
    "assessments:read",
    "certificates:read",
    "notifications:read",
    "dashboard:trainer",
    "settings:write",
  ],
  employee: [
    "departments:read",
    "induction:read",
    "sops:read",
    "training:read",
    "training:attend",
    "assessments:take",
    "certificates:read",
    "notifications:read",
    "jd:read",
    "tni:read",
    "dashboard:employee",
    "settings:write",
  ],
};

/** Super Admin always has every permission (including future ones). */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  if (role === "super_admin") return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  hr: "HR",
  qa: "QA",
  department_head: "Department Head",
  trainer: "Trainer",
  employee: "Employee",
};

export const ROLE_DASHBOARD_ROUTES: Record<UserRole, string> = {
  super_admin: "/dashboard",
  hr: "/dashboard/hr",
  qa: "/dashboard/qa",
  department_head: "/dashboard/department",
  trainer: "/dashboard/trainer",
  employee: "/dashboard/employee",
};
