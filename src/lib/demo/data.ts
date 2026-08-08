/**
 * Demo seed data for local development without Firebase credentials.
 * Enable with NEXT_PUBLIC_DEMO_MODE=true
 */

import type {
  UserProfile,
  Employee,
  Department,
  InductionModule,
  SopDocument,
  TrainingAssignment,
  Certificate,
  AuditLog,
  DashboardStats,
  Question,
  Exam,
  Notification,
} from "@/types";
import { toDefaultDepartments } from "@/lib/departments/defaults";

export const DEMO_USERS: Record<string, { password: string; profile: UserProfile }> = {
  "admin@pharma.local": {
    password: "Admin@123",
    profile: {
      id: "user_admin",
      uid: "user_admin",
      email: "admin@pharma.local",
      displayName: "System Admin",
      role: "super_admin",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "system",
    },
  },
  "hr@pharma.local": {
    password: "Hr@12345",
    profile: {
      id: "user_hr",
      uid: "user_hr",
      email: "hr@pharma.local",
      displayName: "Priya Sharma",
      role: "hr",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "system",
    },
  },
  "qa@pharma.local": {
    password: "Qa@12345",
    profile: {
      id: "user_qa",
      uid: "user_qa",
      email: "qa@pharma.local",
      displayName: "Rahul Mehta",
      role: "qa",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "system",
    },
  },
  "dept@pharma.local": {
    password: "Dept@123",
    profile: {
      id: "user_dept",
      uid: "user_dept",
      email: "dept@pharma.local",
      displayName: "Ananya Patel",
      role: "department_head",
      departmentId: "dept_qa",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "system",
    },
  },
  "trainer@pharma.local": {
    password: "Train@123",
    profile: {
      id: "user_trainer",
      uid: "user_trainer",
      email: "trainer@pharma.local",
      displayName: "Vikram Singh",
      role: "trainer",
      departmentId: "dept_qa",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "system",
    },
  },
  "employee@pharma.local": {
    password: "Emp@12345",
    profile: {
      id: "user_emp",
      uid: "user_emp",
      email: "employee@pharma.local",
      displayName: "Aarav Kumar",
      role: "employee",
      employeeId: "emp_001",
      departmentId: "dept_qa",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "system",
    },
  },
};

export const DEMO_DEPARTMENTS: Department[] = toDefaultDepartments().map((d) =>
  d.id === "dept_qa" ? { ...d, headUserId: "user_dept" } : d
);

/** Sample records cleared — app uses Firebase / empty local stores. */
export const DEMO_EMPLOYEES: Employee[] = [];

export const DEMO_INDUCTION_MODULES: InductionModule[] = [];

export const DEMO_SOPS: SopDocument[] = [];

export const DEMO_ASSIGNMENTS: TrainingAssignment[] = [];

export const DEMO_CERTIFICATES: Certificate[] = [];

export const DEMO_QUESTIONS: Question[] = [];

export const DEMO_EXAMS: Exam[] = [];

export const DEMO_AUDIT: AuditLog[] = [];

export const DEMO_NOTIFICATIONS: Notification[] = [];

export const DEMO_STATS: DashboardStats = {
  totalEmployees: 0,
  activeTrainings: 0,
  pendingAssessments: 0,
  complianceRate: 0,
  certificatesIssued: 0,
  overdueTrainings: 0,
  sopRevisionsThisMonth: 0,
  inductionInProgress: 0,
};

/** Demo mode only when explicitly enabled — Firebase project is the default. */
export const isDemoMode = () => process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const DEMO_ADMIN_USERS_KEY = "pharma_lms_demo_admin_users";

/** Staff accounts created by Super Admin in demo mode (browser only). */
export function getDemoAdminUsers(): Record<string, { password: string; profile: UserProfile }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DEMO_ADMIN_USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveDemoAdminUser(
  email: string,
  entry: { password: string; profile: UserProfile }
) {
  const all = getDemoAdminUsers();
  all[email.toLowerCase()] = entry;
  localStorage.setItem(DEMO_ADMIN_USERS_KEY, JSON.stringify(all));
}

export function updateDemoAdminUser(
  email: string,
  entry: { password: string; profile: UserProfile }
) {
  saveDemoAdminUser(email, entry);
}

export function removeDemoAdminUser(email: string) {
  const all = getDemoAdminUsers();
  delete all[email.toLowerCase()];
  localStorage.setItem(DEMO_ADMIN_USERS_KEY, JSON.stringify(all));
}

export function findDemoAdminUserByUid(
  uid: string
): [string, { password: string; profile: UserProfile }] | null {
  const entry = Object.entries(getDemoAdminUsers()).find(([, v]) => v.profile.uid === uid);
  return entry ? [entry[0], entry[1]] : null;
}

const DEMO_PW_OVERRIDE_KEY = "pharma_lms_demo_pw_overrides";

function getDemoPasswordOverrides(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DEMO_PW_OVERRIDE_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Persist password change for built-in demo accounts (session / browser only). */
export function setDemoPasswordOverride(email: string, password: string): void {
  if (typeof window === "undefined") return;
  const all = getDemoPasswordOverrides();
  all[email.trim().toLowerCase()] = password;
  localStorage.setItem(DEMO_PW_OVERRIDE_KEY, JSON.stringify(all));
}

/** Built-in demo accounts + Super Admin–created demo staff (+ password overrides). */
export function getAllDemoUserEntries(): Record<string, { password: string; profile: UserProfile }> {
  const base: Record<string, { password: string; profile: UserProfile }> = {
    ...DEMO_USERS,
    ...getDemoAdminUsers(),
  };
  const overrides = getDemoPasswordOverrides();
  for (const [email, password] of Object.entries(overrides)) {
    if (base[email]) {
      base[email] = { ...base[email], password };
    }
  }
  return base;
}
