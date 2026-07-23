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
  | "employees:handover"
  | "induction:read"
  | "induction:write"
  | "induction:assign"
  | "departments:read"
  | "departments:write"
  | "jd:read"
  | "jd:write"
  | "jd:approve"
  | "tni:read"
  | "tni:write"
  | "tni:approve"
  | "sops:read"
  | "sops:write"
  | "sops:approve"
  | "sops:assign"
  | "trainers:read"
  | "trainers:write"
  | "training:read"
  | "training:write"
  | "training:conduct"
  | "training:attend"
  | "assessments:read"
  | "assessments:write"
  | "assessments:take"
  | "questions:read"
  | "questions:write"
  | "exams:read"
  | "exams:write"
  | "certificates:read"
  | "certificates:issue"
  | "reports:read"
  | "reports:export"
  | "notifications:read"
  | "audit:read"
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
  "employees:handover",
  "induction:read",
  "induction:write",
  "induction:assign",
  "departments:read",
  "departments:write",
  "jd:read",
  "jd:write",
  "jd:approve",
  "tni:read",
  "tni:write",
  "tni:approve",
  "sops:read",
  "sops:write",
  "sops:approve",
  "sops:assign",
  "trainers:read",
  "trainers:write",
  "training:read",
  "training:write",
  "training:conduct",
  "training:attend",
  "assessments:read",
  "assessments:write",
  "assessments:take",
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
  "dashboard:admin",
  "dashboard:hr",
  "dashboard:qa",
  "dashboard:dept",
  "dashboard:trainer",
  "dashboard:employee",
  "settings:write",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  hr: [
    "employees:read",
    "employees:write",
    "employees:handover",
    "induction:read",
    "induction:write",
    "induction:assign",
    "departments:read",
    "assessments:read",
    "assessments:write",
    "questions:read",
    "questions:write",
    "exams:read",
    "exams:write",
    "certificates:read",
    "reports:read",
    "reports:export",
    "notifications:read",
    "audit:read",
    "dashboard:hr",
    "users:read",
    "training:read",
  ],
  qa: [
    "sops:read",
    "sops:write",
    "sops:approve",
    "sops:assign",
    "departments:read",
    "employees:read",
    "training:read",
    "assessments:read",
    "questions:read",
    "questions:write",
    "exams:read",
    "exams:write",
    "certificates:read",
    "reports:read",
    "reports:export",
    "notifications:read",
    "audit:read",
    "dashboard:qa",
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
  ],
  trainer: [
    "employees:read",
    "sops:read",
    "training:read",
    "training:conduct",
    "trainers:read",
    "assessments:read",
    "certificates:read",
    "notifications:read",
    "dashboard:trainer",
  ],
  employee: [
    "induction:read",
    "sops:read",
    "training:read",
    "training:attend",
    "assessments:take",
    "certificates:read",
    "notifications:read",
    "jd:read",
    "dashboard:employee",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
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
