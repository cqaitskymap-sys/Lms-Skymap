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
import { localDayBound } from "@/lib/utils";
import { listEmployeesForLifecycle, lifecycleDashboardStats } from "@/lib/services/lifecycle";
import { getEmployee } from "@/lib/services/employees";
import { listDepartments } from "@/lib/services/departments";
import { listSopsDetailed, listSopsForEmployee } from "@/lib/services/sops";
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
  /** Department heads only see this department. */
  departmentId?: string;
  /** Skip the short in-memory snapshot (use after the user changes data). */
  fresh?: boolean;
};

const SNAPSHOT_CACHE_MS = 20_000;
const snapshotCache = new Map<string, { at: number; snap: DashboardSnapshot }>();
const snapshotInflight = new Map<string, Promise<DashboardSnapshot>>();
const snapshotGen = new Map<string, number>();

function snapshotCacheKey(opts: DashboardSnapshotOpts): string {
  return [opts.userId || "", opts.role || "", opts.employeeId || "", opts.departmentId || ""].join(
    "|"
  );
}

export async function fetchDashboardSnapshot(
  opts?: DashboardSnapshotOpts | string
): Promise<DashboardSnapshot> {
  // Back-compat: older callers passed userId as a bare string.
  const normalized: DashboardSnapshotOpts =
    typeof opts === "string" ? { userId: opts } : opts || {};
  const { userId, role, employeeId, departmentId, fresh } = normalized;
  const cacheKey = snapshotCacheKey(normalized);
  if (!fresh) {
    const hit = snapshotCache.get(cacheKey);
    if (hit && Date.now() - hit.at < SNAPSHOT_CACHE_MS) return hit.snap;
    const pending = snapshotInflight.get(cacheKey);
    if (pending) return pending;
  }

  const generation = (snapshotGen.get(cacheKey) || 0) + 1;
  snapshotGen.set(cacheKey, generation);
  const job = loadDashboardSnapshot({ userId, role, employeeId, departmentId })
    .then((snap) => {
      if (snapshotGen.get(cacheKey) === generation) {
        snapshotCache.set(cacheKey, { at: Date.now(), snap });
      }
      return snap;
    })
    .finally(() => {
      if (snapshotInflight.get(cacheKey) === job) snapshotInflight.delete(cacheKey);
    });
  snapshotInflight.set(cacheKey, job);
  return job;
}

async function loadDashboardSnapshot(opts: DashboardSnapshotOpts): Promise<DashboardSnapshot> {
  const { userId, role, employeeId, departmentId } = opts;
  // Missing role → treat as restricted (avoid collection-wide lists that 403).
  const isEmployee = !role || role === "employee";
  const canListOrg =
    role === "super_admin" ||
    role === "hr" ||
    role === "qa" ||
    role === "department_head" ||
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
    isEmployee
      ? employeeId
        ? listSopsForEmployee(employeeId).catch(() => [] as SopDocument[])
        : Promise.resolve([] as SopDocument[])
      : listSopsDetailed().catch(() => [] as SopDocument[]),
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

  let scopedEmployees = employees;
  let scopedAssignments = assignments;
  let scopedSessions = sessions;
  let scopedCertificates = certificates;
  let scopedSops = sops;
  let scopedJds = jds;
  let scopedTnis = tnis;

  if (role === "department_head" && departmentId) {
    scopedEmployees = employees.filter((e) => e.departmentId === departmentId);
    const memberIds = new Set(scopedEmployees.map((e) => e.id));
    scopedAssignments = assignments.filter(
      (a) => a.departmentId === departmentId || memberIds.has(a.employeeId)
    );
    scopedSessions = sessions.filter((s) => s.departmentId === departmentId);
    scopedCertificates = certificates.filter(
      (c) => c.departmentId === departmentId || memberIds.has(c.employeeId)
    );
    scopedSops = sops.filter((s) => s.departmentIds?.includes(departmentId));
    scopedJds = jds.filter((j) => j.departmentId === departmentId);
    scopedTnis = tnis.filter((t) => t.departmentId === departmentId);
  } else if (role === "department_head") {
    scopedEmployees = [];
    scopedAssignments = [];
    scopedSessions = [];
    scopedCertificates = [];
    scopedSops = [];
    scopedJds = [];
    scopedTnis = [];
  } else if (role === "trainer") {
    const mine = userId
      ? sessions.filter((s) => s.trainerId === userId || s.createdBy === userId)
      : [];
    const sessionIds = new Set(mine.map((s) => s.id));
    scopedSessions = mine;
    scopedAssignments = userId
      ? assignments.filter(
          (a) =>
            (a.sessionId && sessionIds.has(a.sessionId)) ||
            a.trainerId === userId ||
            a.assignedBy === userId ||
            a.createdBy === userId
        )
      : [];
    const employeeIds = new Set(scopedAssignments.map((a) => a.employeeId));
    scopedEmployees = employees.filter((e) => employeeIds.has(e.id));
    scopedCertificates = certificates.filter(
      (c) => employeeIds.has(c.employeeId) || (userId ? c.trainerId === userId : false)
    );
    const sopIds = new Set(
      [...scopedSessions, ...scopedAssignments]
        .map((row) => row.sopId)
        .filter((id): id is string => Boolean(id))
    );
    scopedSops = sops.filter((s) => sopIds.has(s.id));
    scopedJds = [];
    scopedTnis = [];
  } else if (isEmployee && employeeId) {
    const mine = new Set(
      assignments.filter((a) => a.employeeId === employeeId).map((a) => a.sessionId).filter(Boolean)
    );
    scopedSessions = sessions.filter(
      (s) =>
        mine.has(s.id) ||
        (s.attendance || []).some((row) => row.employeeId === employeeId)
    );
  } else if (isEmployee) {
    scopedEmployees = [];
    scopedAssignments = [];
    scopedSessions = [];
    scopedCertificates = [];
    scopedSops = [];
  }

  return {
    employees: scopedEmployees,
    departments,
    sops: scopedSops,
    assignments: scopedAssignments,
    sessions: scopedSessions,
    certificates: scopedCertificates,
    jds: scopedJds,
    tnis: scopedTnis,
    trainers,
    notifications,
    audit,
    loadedAt: new Date().toISOString(),
  };
}

function isOverdue(dueDate?: string, status?: string) {
  if (!dueDate || status === "passed" || status === "failed" || status === "expired") {
    return false;
  }
  const end = localDayBound(dueDate, true);
  if (Number.isNaN(end)) return false;
  return end < Date.now();
}

function sopAwaitingReview(sop: { status?: string; pendingStatus?: string; pendingVersionId?: string }) {
  if (sop.status === "under_review") return true;
  return (
    sop.status === "approved" &&
    sop.pendingStatus === "under_review" &&
    Boolean(sop.pendingVersionId)
  );
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
 * by then, counting only those already passed. Uses the assignment update
 * time (set when the exam is marked passed), not the earlier classroom date.
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
      const doneAt = a.updatedAt || a.createdAt;
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

  const statusBucket = (a: TrainingAssignment) => {
    if (a.status === "passed") return "passed";
    if (a.status === "failed" || a.status === "expired") return "closed";
    if (a.status === "retraining" || a.isRetraining) return "retraining";
    if (isOverdue(a.dueDate, a.status)) return "overdue";
    if (
      ["assigned", "in_progress", "training_completed", "assessment_pending"].includes(
        a.status
      )
    ) {
      return "in_progress";
    }
    return "closed";
  };
  const statusDistribution = [
    {
      name: "Passed",
      value: asg.filter((a) => statusBucket(a) === "passed").length,
      color: "hsl(152, 61%, 36%)",
    },
    {
      name: "In progress",
      value: asg.filter((a) => statusBucket(a) === "in_progress").length,
      color: "hsl(199, 89%, 40%)",
    },
    {
      name: "Retraining",
      value: asg.filter((a) => statusBucket(a) === "retraining").length,
      color: "hsl(25, 95%, 45%)",
    },
    {
      name: "Overdue",
      value: asg.filter((a) => statusBucket(a) === "overdue").length,
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
  const underReview = snap.sops.filter((s) => sopAwaitingReview(s)).length;
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
      const start = localDayBound(s.reviewDate!, false);
      const end = localDayBound(s.reviewDate!, true);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      const daysUntilStart = (start - now) / 86400000;
      return now <= end && daysUntilStart <= 60;
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
    actor: e.actorName || e.actorEmployeeCode || e.actorEmail || e.actorId,
    actorName: e.actorName,
    actorEmail: e.actorEmail,
    actorEmployeeCode: e.actorEmployeeCode,
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
