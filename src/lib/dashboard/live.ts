/**
 * Live dashboard snapshot — fetches from Firebase/demo services (not localStorage-only).
 */

import {
  Users,
  UserPlus,
  FileText,
  GraduationCap,
  ClipboardList,
  Award,
  Shield,
  BookOpen,
  Calendar,
  Target,
  Briefcase,
} from "lucide-react";
import { latestAssignmentsByCell } from "@/lib/training/matrix";
import { listEmployeesForLifecycle, lifecycleDashboardStats } from "@/lib/services/lifecycle";
import { getEmployee } from "@/lib/services/employees";
import { listDepartments } from "@/lib/services/departments";
import { listSopsDetailed } from "@/lib/services/sops";
import {
  listJobDescriptions,
  listTNIs,
  listTrainingAssignments,
  getEmployeeAssignments,
  listTrainingSessions,
  getUserNotifications,
  listTrainers,
} from "@/lib/services/training";
import { listCertificates } from "@/lib/services/certificates";
import { listAuditLogs } from "@/lib/services/audit-logs";
import type {
  DashActivity,
  DashAlert,
  DashNotification,
  DashStat,
  DashTask,
  DashTrainingItem,
} from "@/lib/dashboard/data";
import type {
  AuditLog,
  Certificate,
  Department,
  Employee,
  JobDescription,
  Notification,
  SopDocument,
  TrainerProfile,
  TrainingAssignment,
  TrainingNeedIdentification,
  TrainingSession,
  UserRole,
} from "@/types";

export interface DashboardSnapshot {
  employees: Employee[];
  departments: Department[];
  sops: SopDocument[];
  assignments: TrainingAssignment[];
  sessions: TrainingSession[];
  certificates: Certificate[];
  jds: JobDescription[];
  tnis: TrainingNeedIdentification[];
  trainers: TrainerProfile[];
  notifications: Notification[];
  audit: AuditLog[];
  loadedAt: string;
}

export function emptyDashboardSnapshot(): DashboardSnapshot {
  return {
    employees: [],
    departments: [],
    sops: [],
    assignments: [],
    sessions: [],
    certificates: [],
    jds: [],
    tnis: [],
    trainers: [],
    notifications: [],
    audit: [],
    loadedAt: new Date().toISOString(),
  };
}

export type DashboardSnapshotOpts = {
  userId?: string;
  /** Used to avoid Firestore list queries the role cannot read. */
  role?: UserRole | "super_admin" | string;
  employeeId?: string;
};

export async function fetchDashboardSnapshot(
  opts?: DashboardSnapshotOpts | string
): Promise<DashboardSnapshot> {
  // Back-compat: older callers passed userId as a bare string.
  const normalized: DashboardSnapshotOpts =
    typeof opts === "string" ? { userId: opts } : opts || {};
  const { userId, role, employeeId } = normalized;
  // Missing role → treat as restricted (avoid collection-wide lists that 403).
  const isEmployee = !role || role === "employee";
  const canListOrg =
    role === "super_admin" ||
    role === "hr" ||
    role === "qa" ||
    role === "dept_head" ||
    role === "trainer";
  const canReadAudit =
    role === "super_admin" || role === "hr" || role === "qa";

  const employeesPromise = canListOrg
    ? listEmployeesForLifecycle().catch(() => [] as Employee[])
    : employeeId
      ? getEmployee(employeeId)
          .then((e) => (e ? [e] : []))
          .catch(() => [] as Employee[])
      : Promise.resolve([] as Employee[]);

  const assignmentsPromise = canListOrg
    ? listTrainingAssignments().catch(() => [] as TrainingAssignment[])
    : employeeId
      ? getEmployeeAssignments(employeeId).catch(() => [] as TrainingAssignment[])
      : Promise.resolve([] as TrainingAssignment[]);

  const certificatesPromise = canListOrg
    ? listCertificates().catch(() => [] as Certificate[])
    : employeeId
      ? listCertificates({ employeeId }).catch(() => [] as Certificate[])
      : Promise.resolve([] as Certificate[]);

  const auditPromise = canReadAudit
    ? listAuditLogs(50).catch(() => [] as AuditLog[])
    : Promise.resolve([] as AuditLog[]);

  const [
    employees,
    departments,
    sops,
    assignments,
    sessions,
    certificates,
    jds,
    tnis,
    trainers,
    notifications,
    audit,
  ] = await Promise.all([
    employeesPromise,
    listDepartments().catch(() => [] as Department[]),
    listSopsDetailed().catch(() => [] as SopDocument[]),
    assignmentsPromise,
    listTrainingSessions().catch(() => [] as TrainingSession[]),
    certificatesPromise,
    isEmployee
      ? Promise.resolve([] as JobDescription[])
      : listJobDescriptions().catch(() => [] as JobDescription[]),
    isEmployee
      ? Promise.resolve([] as TrainingNeedIdentification[])
      : listTNIs().catch(() => [] as TrainingNeedIdentification[]),
    isEmployee
      ? Promise.resolve([] as TrainerProfile[])
      : listTrainers().catch(() => [] as TrainerProfile[]),
    userId ? getUserNotifications(userId).catch(() => [] as Notification[]) : Promise.resolve([]),
    auditPromise,
  ]);

  return {
    employees,
    departments,
    sops,
    assignments,
    sessions,
    certificates,
    jds,
    tnis,
    trainers,
    notifications,
    audit,
    loadedAt: new Date().toISOString(),
  };
}

function isOverdue(dueDate?: string, status?: string) {
  if (!dueDate || status === "passed") return false;
  return new Date(dueDate) < new Date();
}

function complianceRate(asg: TrainingAssignment[]): number {
  const latest = latestAssignmentsByCell(asg);
  if (!latest.length) return 0;
  const passed = latest.filter((a) => a.status === "passed").length;
  return Math.round((passed / latest.length) * 1000) / 10;
}

/** Tone for compliance KPI cards — red/amber until near target (90%). */
function complianceTone(rate: number): "success" | "warning" | "danger" {
  if (rate >= 90) return "success";
  if (rate >= 60) return "warning";
  return "danger";
}

/**
 * Real last-6-month pass rate: for each month-end, assignments that existed
 * by then, counting only those marked passed by that date.
 */
function buildComplianceTrend(
  asg: TrainingAssignment[]
): { month: string; rate: number }[] {
  const now = new Date();
  const points: { month: string; rate: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    const label = monthStart.toLocaleString("en-US", { month: "short" });
    const existed = asg.filter((a) => new Date(a.createdAt).getTime() <= monthEnd.getTime());
    if (!existed.length) {
      points.push({ month: label, rate: 0 });
      continue;
    }
    const passed = existed.filter((a) => {
      if (a.status !== "passed") return false;
      const doneAt = a.trainingCompletedAt || a.updatedAt || a.createdAt;
      return new Date(doneAt).getTime() <= monthEnd.getTime();
    }).length;
    points.push({
      month: label,
      rate: Math.round((passed / existed.length) * 1000) / 10,
    });
  }

  return points;
}

export function buildDashboardView(snap: DashboardSnapshot, role: string) {
  const asg = snap.assignments;
  const compliance = complianceRate(asg);
  const overdueCount = asg.filter((a) => isOverdue(a.dueDate, a.status)).length;
  const active = asg.filter((a) => !["passed", "failed"].includes(a.status)).length;
  const stats = lifecycleDashboardStats(snap.employees);
  const cmpTone = complianceTone(compliance);

  const complianceTrend = buildComplianceTrend(asg);
  const trainingProgress = [
    {
      name: "Now",
      completed: asg.filter((a) => a.status === "passed").length,
      inProgress: asg.filter((a) => !["passed", "failed"].includes(a.status)).length,
      overdue: overdueCount,
    },
  ];

  const deptCompliance = snap.departments
    .map((d) => {
      const list = asg.filter((a) => a.departmentId === d.id);
      const passed = list.filter((a) => a.status === "passed").length;
      const rate = list.length ? Math.round((passed / list.length) * 100) : 0;
      return { name: d.code || d.name, rate };
    })
    .slice(0, 8);

  const statusDistribution = [
    {
      name: "Passed",
      value: asg.filter((a) => a.status === "passed").length,
      color: "hsl(152, 61%, 36%)",
    },
    {
      name: "In progress",
      value: asg.filter((a) =>
        ["assigned", "in_progress", "training_completed", "assessment_pending"].includes(
          a.status
        )
      ).length,
      color: "hsl(199, 89%, 40%)",
    },
    {
      name: "Retraining",
      value: asg.filter((a) => a.status === "retraining" || a.isRetraining).length,
      color: "hsl(25, 95%, 45%)",
    },
    {
      name: "Overdue",
      value: overdueCount,
      color: "hsl(0, 72%, 51%)",
    },
  ];

  const upcoming: DashTrainingItem[] = snap.sessions
    .filter((s) => s.status === "scheduled" || s.status === "in_progress")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: `${s.mode} · ${s.attendance?.length || 0} attendees`,
      date: s.scheduledAt,
      status: s.status,
      href: `/dashboard/training/sessions/${s.id}`,
    }));

  const overdueItems: DashTrainingItem[] = asg
    .filter((a) => isOverdue(a.dueDate, a.status))
    .slice(0, 8)
    .map((a) => {
      const e = snap.employees.find((x) => x.id === a.employeeId);
      const s = snap.sops.find((x) => x.id === a.sopId);
      return {
        id: a.id,
        title: s ? `${s.sopNumber} — ${s.title}` : a.sopId,
        subtitle: e ? `${e.firstName} ${e.lastName}` : a.employeeId,
        date: a.dueDate || a.createdAt,
        status: "overdue",
        href: a.sessionId
          ? `/dashboard/training/sessions/${a.sessionId}`
          : "/dashboard/training",
      };
    });

  const tasks: DashTask[] = [];
  if (stats.pendingVerification > 0 && (role === "hr" || role === "super_admin")) {
    tasks.push({
      id: "verify",
      title: `Verify ${stats.pendingVerification} employee(s)`,
      due: "Today",
      priority: "high",
      href: "/dashboard/employees",
    });
  }
  if (stats.readyForHandover > 0 && (role === "hr" || role === "super_admin")) {
    tasks.push({
      id: "handover",
      title: `Handover ${stats.readyForHandover} employee(s)`,
      due: "Today",
      priority: "medium",
      href: "/dashboard/employees",
    });
  }
  const underReview = snap.sops.filter((s) => s.status === "under_review").length;
  if (underReview > 0 && (role === "qa" || role === "super_admin")) {
    tasks.push({
      id: "sop_review",
      title: `Review ${underReview} SOP(s)`,
      due: "Today",
      priority: "high",
      href: "/dashboard/sops",
    });
  }
  const pendingAssess = asg.filter((a) => a.status === "assessment_pending").length;
  if (pendingAssess > 0) {
    tasks.push({
      id: "assess",
      title: `${pendingAssess} assessment(s) pending`,
      due: "Today",
      priority: "medium",
      href: "/dashboard/exams",
    });
  }
  if (!tasks.length) {
    tasks.push({
      id: "ok",
      title: "No urgent tasks",
      due: "Today",
      priority: "low",
    });
  }

  const notifications: DashNotification[] = snap.notifications.slice(0, 8).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    time: n.createdAt,
    unread: !n.isRead,
    href: n.link,
  }));

  const auditAlerts: DashAlert[] = [];
  if (overdueCount > 0) {
    auditAlerts.push({
      id: "overdue",
      title: "Overdue training",
      message: `${overdueCount} assignment(s) past due date`,
      severity: "critical",
      time: new Date().toISOString(),
      href: "/dashboard/training",
    });
  }
  const failed = asg.filter((a) => a.status === "failed").length;
  if (failed > 0) {
    auditAlerts.push({
      id: "failed",
      title: "Failed assessments",
      message: `${failed} assignment(s) need retraining`,
      severity: "warning",
      time: new Date().toISOString(),
      href: "/dashboard/training",
    });
  }

  const now = Date.now();
  const sopAlerts: DashAlert[] = snap.sops
    .filter((s) => s.reviewDate)
    .filter((s) => {
      const days = (new Date(s.reviewDate!).getTime() - now) / 86400000;
      return days >= 0 && days <= 60;
    })
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      title: `${s.sopNumber} review due`,
      message: s.title,
      severity: "warning" as const,
      time: s.reviewDate!,
      href: `/dashboard/sops/${s.id}`,
    }));

  const activities: DashActivity[] = snap.audit.slice(0, 12).map((e) => ({
    id: e.id,
    description: e.description,
    actor: e.actorEmail || e.actorId,
    action: e.action,
    timestamp: e.timestamp,
  }));

  let roleStats: DashStat[];
  if (role === "hr") {
    roleStats = [
      { title: "Employees", value: stats.total, icon: Users, description: "Workforce" },
      {
        title: "Pending verification",
        value: stats.pendingVerification,
        icon: Shield,
        tone: stats.pendingVerification ? "warning" : "success",
      },
      {
        title: "Induction in progress",
        value: stats.inductionInProgress,
        icon: GraduationCap,
      },
      {
        title: "Ready for handover",
        value: stats.readyForHandover,
        icon: UserPlus,
        tone: "success",
      },
    ];
  } else if (role === "qa") {
    roleStats = [
      { title: "Total SOPs", value: snap.sops.length, icon: FileText },
      {
        title: "Under review",
        value: underReview,
        icon: ClipboardList,
        tone: underReview ? "warning" : "success",
      },
      {
        title: "Approved",
        value: snap.sops.filter((s) => s.status === "approved").length,
        icon: BookOpen,
      },
      {
        title: "Compliance",
        value: `${compliance}%`,
        icon: Shield,
        tone: cmpTone,
      },
    ];
  } else if (role === "department_head") {
    roleStats = [
      { title: "Team members", value: snap.employees.length, icon: Users },
      {
        title: "Open JDs",
        value: snap.jds.filter((j) => j.status === "draft").length,
        icon: Briefcase,
      },
      {
        title: "Open TNIs",
        value: snap.tnis.filter((t) => t.status === "draft" || t.status === "submitted")
          .length,
        icon: Target,
      },
      {
        title: "Dept compliance",
        value: `${compliance}%`,
        icon: Shield,
        tone: cmpTone,
      },
    ];
  } else if (role === "trainer") {
    roleStats = [
      {
        title: "Upcoming sessions",
        value: snap.sessions.filter((s) => s.status === "scheduled").length,
        icon: Calendar,
      },
      { title: "Active assignments", value: active, icon: Users },
      {
        title: "Completed sessions",
        value: snap.sessions.filter((s) => s.status === "completed").length,
        icon: Award,
        tone: "success",
      },
      {
        title: "Pending attendance",
        value: snap.sessions.filter((s) => s.status === "in_progress").length,
        icon: ClipboardList,
        tone: "warning",
      },
    ];
  } else if (role === "employee") {
    roleStats = [
      { title: "My trainings", value: asg.length, icon: GraduationCap },
      {
        title: "Assessments due",
        value: asg.filter((a) => a.status === "assessment_pending").length,
        icon: ClipboardList,
        tone: "warning",
      },
      {
        title: "Certificates",
        value: snap.certificates.length,
        icon: Award,
        tone: "success",
      },
      {
        title: "My compliance",
        value: `${compliance}%`,
        icon: Shield,
        tone: cmpTone,
      },
    ];
  } else {
    roleStats = [
      {
        title: "Employees",
        value: stats.total,
        icon: Users,
        description: "Active workforce",
      },
      {
        title: "Compliance",
        value: `${compliance}%`,
        icon: Shield,
        tone: cmpTone,
      },
      {
        title: "Active trainings",
        value: active,
        icon: GraduationCap,
        description: "Across departments",
      },
      {
        title: "Overdue",
        value: overdueCount,
        icon: ClipboardList,
        tone: overdueCount ? "danger" : "success",
        description: "Needs attention",
      },
    ];
  }

  return {
    roleStats,
    compliance,
    complianceTrend,
    trainingProgress,
    deptCompliance,
    statusDistribution,
    upcoming,
    overdueItems,
    tasks,
    notifications,
    auditAlerts,
    sopAlerts,
    activities,
    assignmentRows: asg.slice(0, 10).map((a) => {
      const e = snap.employees.find((x) => x.id === a.employeeId);
      const s = snap.sops.find((x) => x.id === a.sopId);
      return {
        id: a.id,
        employee: e ? `${e.firstName} ${e.lastName}` : a.employeeId,
        sop: s ? s.sopNumber : a.sopId,
        status: a.status,
        score: a.score,
      };
    }),
  };
}
