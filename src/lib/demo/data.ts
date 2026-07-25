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

export const DEMO_DEPARTMENTS: Department[] = [
  {
    id: "dept_qa",
    code: "QA",
    name: "Quality Assurance",
    description: "QA / QC operations",
    headUserId: "user_dept",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "system",
  },
  {
    id: "dept_prod",
    code: "PRD",
    name: "Production",
    description: "Manufacturing operations",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "system",
  },
  {
    id: "dept_wh",
    code: "WH",
    name: "Warehouse",
    description: "Storage and distribution",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "system",
  },
];

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
