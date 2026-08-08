/**
 * Build filtered report datasets from Firestore-backed LMS services.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore/lite";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import { listAuditLogs } from "@/lib/services/audit-logs";
import { listCertificates } from "@/lib/services/certificates";
import { listDepartments } from "@/lib/services/departments";
import { listEmployeesForLifecycle } from "@/lib/services/lifecycle";
import { listSopsDetailed } from "@/lib/services/sops";
import {
  listTrainers,
  listTrainingAssignments,
} from "@/lib/services/training";
import { readAssessmentStore } from "@/lib/assessments/demo-store";
import { isDemoMode } from "@/lib/demo/data";
import {
  latestAssignmentsByCell,
  matrixCellLabel,
  matrixCellStatus,
  resolveLatestAssignment,
  scopeMatrixEmployees,
  filterMatrixSops,
} from "@/lib/training/matrix";
import { formatDate } from "@/lib/utils";
import type {
  AuditLog,
  Certificate,
  Department,
  Employee,
  ExamResult,
  SopDocument,
  TrainerProfile,
  TrainingAssignment,
  UserProfile,
} from "@/types";
import type {
  ChartPoint,
  ReportDataset,
  ReportFilters,
  ReportType,
} from "@/lib/reports/types";
import { REPORT_CATALOG } from "@/lib/reports/types";

export type ReportLoadOptions = {
  /** Force department scope (department heads). */
  departmentId?: string;
  /** Load audit trail (requires audit:read). */
  includeAudit?: boolean;
};

type ReportSnapshot = {
  employees: Employee[];
  departments: Department[];
  sops: SopDocument[];
  assignments: TrainingAssignment[];
  trainers: TrainerProfile[];
  certificates: Certificate[];
  examResults: ExamResult[];
  auditLogs: AuditLog[];
  trainerNames: Record<string, string>;
  warnings: string[];
};

let snap: ReportSnapshot | null = null;

function data(): ReportSnapshot {
  if (!snap) throw new Error("Report snapshot not loaded");
  return snap;
}

function today(): Date {
  return new Date();
}

async function soft<T>(
  label: string,
  promise: Promise<T>,
  fallback: T,
  warnings: string[]
): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    warnings.push(
      `${label}: ${err instanceof Error ? err.message : "failed to load"}`
    );
    return fallback;
  }
}

async function loadExamResults(): Promise<ExamResult[]> {
  if (isDemoMode()) {
    return [...readAssessmentStore().results].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }
  try {
    const q = query(
      collection(db, COLLECTIONS.examResults),
      orderBy("createdAt", "desc"),
      limit(500)
    );
    const docs = await getDocs(q);
    return docs.docs.map((d) => ({ id: d.id, ...d.data() }) as ExamResult);
  } catch {
    const docs = await getDocs(
      query(collection(db, COLLECTIONS.examResults), limit(500))
    );
    return docs.docs.map((d) => ({ id: d.id, ...d.data() }) as ExamResult);
  }
}

async function loadTrainerNames(
  trainers: TrainerProfile[],
  employees: Employee[]
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  const byEmployee = new Map(
    employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()])
  );

  for (const t of trainers) {
    if (t.employeeId && byEmployee.has(t.employeeId)) {
      const n = byEmployee.get(t.employeeId)!;
      names[t.id] = n;
      names[t.userId] = n;
    }
  }

  const missing = trainers.filter((t) => !names[t.id] && t.userId);
  await Promise.all(
    missing.map(async (t) => {
      try {
        if (isDemoMode()) {
          names[t.id] = t.userId;
          names[t.userId] = t.userId;
          return;
        }
        const snapUser = await getDoc(doc(db, COLLECTIONS.users, t.userId));
        if (snapUser.exists()) {
          const u = snapUser.data() as UserProfile;
          const n = (u.displayName || u.email || t.userId).trim();
          names[t.id] = n;
          names[t.userId] = n;
        }
      } catch {
        /* leave unresolved */
      }
    })
  );

  return names;
}

export async function loadReportSnapshot(
  opts: ReportLoadOptions = {}
): Promise<ReportSnapshot> {
  const warnings: string[] = [];
  const deptId = opts.departmentId;

  const [employeesRaw, departmentsRaw, sopsRaw, assignments, trainers] =
    await Promise.all([
      listEmployeesForLifecycle(),
      listDepartments(),
      listSopsDetailed(),
      listTrainingAssignments(deptId ? { departmentId: deptId } : undefined),
      listTrainers(),
    ]);

  let employees = employeesRaw;
  let departments = departmentsRaw;
  let sops = sopsRaw;

  if (deptId) {
    employees = employees.filter((e) => e.departmentId === deptId);
    departments = departments.filter((d) => d.id === deptId);
    sops = filterMatrixSops(sops, deptId);
  }

  const [certificatesRaw, examResultsRaw, auditLogs] = await Promise.all([
    soft("Certificates", listCertificates(), [] as Certificate[], warnings),
    soft("Exam results", loadExamResults(), [] as ExamResult[], warnings),
    opts.includeAudit
      ? soft("Audit logs", listAuditLogs(300), [] as AuditLog[], warnings)
      : Promise.resolve([] as AuditLog[]),
  ]);

  let certificates = certificatesRaw;
  let examResults = examResultsRaw;
  if (deptId) {
    certificates = certificates.filter((c) => c.departmentId === deptId);
    const empIds = new Set(employees.map((e) => e.id));
    examResults = examResults.filter((r) => empIds.has(r.employeeId));
  }

  const trainerNames = await loadTrainerNames(trainers, employeesRaw);

  return {
    employees,
    departments,
    sops,
    assignments,
    trainers,
    certificates,
    examResults,
    auditLogs,
    trainerNames,
    warnings,
  };
}

function allEmployees() {
  return data().employees;
}

function allDepartments() {
  return data().departments;
}

function allSops() {
  return data().sops;
}

function allAssignments(): TrainingAssignment[] {
  return data().assignments;
}

function allAudit() {
  return data().auditLogs;
}

function empName(id: string) {
  const e = allEmployees().find((x) => x.id === id);
  return e ? `${e.firstName} ${e.lastName}` : id;
}

function empCode(id: string) {
  return allEmployees().find((x) => x.id === id)?.employeeCode || "—";
}

function deptName(id: string | undefined) {
  if (!id) return "—";
  return allDepartments().find((d) => d.id === id)?.name || id;
}

function deptCode(id: string | undefined) {
  if (!id) return "—";
  return allDepartments().find((d) => d.id === id)?.code || id;
}

function sopLabel(id: string) {
  const s = allSops().find((x) => x.id === id);
  return s ? `${s.sopNumber}` : id;
}

function sopTitle(id: string) {
  return allSops().find((x) => x.id === id)?.title || "—";
}

function trainerName(id?: string) {
  if (!id || id === "unassigned") return "—";
  const mapped = data().trainerNames[id];
  if (mapped) return mapped;
  const t = data().trainers.find((x) => x.id === id || x.userId === id);
  if (t) {
    return data().trainerNames[t.id] || data().trainerNames[t.userId] || "Trainer";
  }
  return id;
}

function inDateRange(iso: string | undefined, filters: ReportFilters): boolean {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    if (t < from) return false;
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setHours(23, 59, 59, 999);
    if (t > to.getTime()) return false;
  }
  return true;
}

function matchesSearch(haystack: string, search: string) {
  if (!search.trim()) return true;
  return haystack.toLowerCase().includes(search.trim().toLowerCase());
}

function assignments(filters: ReportFilters) {
  return allAssignments().filter((a) => {
    if (filters.departmentId !== "all" && a.departmentId !== filters.departmentId) {
      return false;
    }
    if (!inDateRange(a.createdAt, filters) && !inDateRange(a.updatedAt, filters)) {
      return false;
    }
    const blob = `${empName(a.employeeId)} ${empCode(a.employeeId)} ${sopLabel(a.sopId)} ${sopTitle(a.sopId)} ${a.status}`;
    return matchesSearch(blob, filters.search);
  });
}

function isOverdue(a: TrainingAssignment) {
  if (!a.dueDate) return false;
  // Graded outcomes are complete — not overdue.
  if (a.status === "passed" || a.status === "failed") return false;
  return new Date(a.dueDate) < today();
}

function catalogMeta(type: ReportType) {
  return REPORT_CATALOG.find((r) => r.type === type)!;
}

function buildEmployeeTraining(filters: ReportFilters): ReportDataset {
  const rows = assignments(filters).map((a) => ({
    employee: empName(a.employeeId),
    employeeCode: empCode(a.employeeId),
    department: deptName(a.departmentId),
    sop: sopLabel(a.sopId),
    sopTitle: sopTitle(a.sopId),
    trainer: trainerName(a.trainerId),
    status: a.status,
    score: a.score ?? "—",
    dueDate: a.dueDate ? formatDate(a.dueDate) : "—",
    overdue: isOverdue(a) ? "Yes" : "No",
  }));

  const completed = rows.filter((r) => r.status === "passed").length;
  const total = rows.length || 1;

  return {
    ...catalogMeta("employee_training"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "employee", label: "Employee" },
      { key: "employeeCode", label: "ID" },
      { key: "department", label: "Department" },
      { key: "sop", label: "SOP" },
      { key: "trainer", label: "Trainer" },
      { key: "status", label: "Status" },
      { key: "score", label: "Score" },
      { key: "dueDate", label: "Due" },
      { key: "overdue", label: "Overdue" },
    ],
    rows,
    kpis: [
      { label: "Assignments", value: rows.length },
      { label: "Completed", value: completed, tone: "success" },
      {
        label: "Completion %",
        value: `${Math.round((completed / total) * 100)}%`,
      },
      {
        label: "Overdue",
        value: rows.filter((r) => r.overdue === "Yes").length,
        tone: "danger",
      },
    ],
    charts: [
      {
        id: "status",
        title: "Status mix",
        kind: "pie",
        data: Object.entries(
          rows.reduce<Record<string, number>>((acc, r) => {
            acc[String(r.status)] = (acc[String(r.status)] || 0) + 1;
            return acc;
          }, {})
        ).map(([name, value]) => ({ name, value })),
      },
    ],
  };
}

function buildDepartmentCompliance(filters: ReportFilters): ReportDataset {
  const asg = assignments({ ...filters, search: filters.search, departmentId: "all" }).filter(
    (a) =>
      filters.departmentId === "all" || a.departmentId === filters.departmentId
  );

  const byDept = allDepartments()
    .filter((d) => filters.departmentId === "all" || d.id === filters.departmentId)
    .map((d) => {
      const list = asg.filter((a) => a.departmentId === d.id);
      const passed = list.filter((a) => a.status === "passed").length;
      const overdue = list.filter(isOverdue).length;
      const rate = list.length ? Math.round((passed / list.length) * 100) : 0;
      return {
        department: d.name,
        code: d.code,
        assignments: list.length,
        completed: passed,
        overdue,
        complianceRate: rate,
      };
    });

  const filtered = byDept.filter((r) =>
    matchesSearch(`${r.department} ${r.code}`, filters.search)
  );

  return {
    ...catalogMeta("department_compliance"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "department", label: "Department" },
      { key: "code", label: "Code" },
      { key: "assignments", label: "Assignments" },
      { key: "completed", label: "Completed" },
      { key: "overdue", label: "Overdue" },
      { key: "complianceRate", label: "Compliance %" },
    ],
    rows: filtered,
    kpis: [
      {
        label: "Avg compliance",
        value: filtered.length
          ? `${Math.round(filtered.reduce((s, r) => s + r.complianceRate, 0) / filtered.length)}%`
          : "0%",
        tone: "success",
      },
      {
        label: "Departments",
        value: filtered.length,
      },
      {
        label: "Total overdue",
        value: filtered.reduce((s, r) => s + r.overdue, 0),
        tone: "warning",
      },
    ],
    charts: [
      {
        id: "compliance",
        title: "Compliance by department",
        kind: "bar",
        data: filtered.map((r) => ({
          name: r.code,
          value: r.complianceRate,
        })),
      },
    ],
  };
}

function buildTrainerPerformance(filters: ReportFilters): ReportDataset {
  const asg = assignments(filters);
  const trainers = new Map<string, typeof asg>();
  for (const a of asg) {
    const tid = a.trainerId || "unassigned";
    if (!trainers.has(tid)) trainers.set(tid, []);
    trainers.get(tid)!.push(a);
  }

  const rows = [...trainers.entries()].map(([tid, list]) => {
    const passed = list.filter((a) => a.status === "passed").length;
    const failed = list.filter((a) => a.status === "failed" || a.isRetraining).length;
    return {
      trainer: trainerName(tid === "unassigned" ? undefined : tid),
      assignments: list.length,
      passed,
      failed,
      passRate: list.length ? Math.round((passed / list.length) * 100) : 0,
      retraining: list.filter((a) => a.isRetraining).length,
    };
  });

  return {
    ...catalogMeta("trainer_performance"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "trainer", label: "Trainer" },
      { key: "assignments", label: "Assignments" },
      { key: "passed", label: "Passed" },
      { key: "failed", label: "Failed" },
      { key: "passRate", label: "Pass %" },
      { key: "retraining", label: "Retraining" },
    ],
    rows,
    kpis: [
      { label: "Trainers", value: rows.length },
      {
        label: "Avg pass %",
        value: rows.length
          ? `${Math.round(rows.reduce((s, r) => s + r.passRate, 0) / rows.length)}%`
          : "0%",
        tone: "success",
      },
    ],
    charts: [
      {
        id: "passRate",
        title: "Pass rate by trainer",
        kind: "bar",
        data: rows.map((r) => ({ name: r.trainer, value: r.passRate })),
      },
    ],
  };
}

function buildExamResults(filters: ReportFilters): ReportDataset {
  // Only real exam_results — never synthesize from assignment scores.
  const results = data().examResults;

  const rows = results
    .filter((r) => inDateRange(r.createdAt, filters))
    .filter((r) => {
      if (filters.departmentId === "all") return true;
      const emp = allEmployees().find((e) => e.id === r.employeeId);
      return emp?.departmentId === filters.departmentId;
    })
    .filter((r) =>
      matchesSearch(`${r.employeeName} ${r.examTitle} ${r.percentage}`, filters.search)
    )
    .map((r) => ({
      employee: r.employeeName,
      exam: r.examTitle,
      score: r.score,
      percentage: r.percentage,
      passed: r.passed ? "Pass" : "Fail",
      certificateEligible: r.certificateEligible ? "Yes" : "No",
      rank: r.rank ?? "—",
      timeMin: Math.round(r.timeSpentSeconds / 60),
      date: formatDate(r.createdAt),
    }));

  const pass = rows.filter((r) => r.passed === "Pass").length;

  return {
    ...catalogMeta("exam_results"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "employee", label: "Employee" },
      { key: "exam", label: "Exam" },
      { key: "percentage", label: "%" },
      { key: "passed", label: "Result" },
      { key: "certificateEligible", label: "Cert eligible" },
      { key: "rank", label: "Rank" },
      { key: "timeMin", label: "Time (min)" },
      { key: "date", label: "Date" },
    ],
    rows,
    kpis: [
      { label: "Attempts", value: rows.length },
      {
        label: "Pass %",
        value: rows.length ? `${Math.round((pass / rows.length) * 100)}%` : "0%",
        tone: "success",
      },
      {
        label: "Fail %",
        value: rows.length
          ? `${Math.round(((rows.length - pass) / rows.length) * 100)}%`
          : "0%",
        tone: "danger",
      },
    ],
    charts: [
      {
        id: "scores",
        title: "Score distribution",
        kind: "bar",
        data: [
          { name: "0-39", value: rows.filter((r) => Number(r.percentage) < 40).length },
          {
            name: "40-59",
            value: rows.filter(
              (r) => Number(r.percentage) >= 40 && Number(r.percentage) < 60
            ).length,
          },
          {
            name: "60-79",
            value: rows.filter(
              (r) => Number(r.percentage) >= 60 && Number(r.percentage) < 80
            ).length,
          },
          { name: "80-100", value: rows.filter((r) => Number(r.percentage) >= 80).length },
        ],
      },
    ],
  };
}

function buildPassFail(filters: ReportFilters): ReportDataset {
  const asg = assignments(filters);
  const decided = asg.filter((a) => a.status === "passed" || a.status === "failed");
  const pass = decided.filter((a) => a.status === "passed").length;
  const fail = decided.filter((a) => a.status === "failed").length;
  const total = decided.length || 1;

  const byDept = allDepartments()
    .map((d) => {
      const list = decided.filter((a) => a.departmentId === d.id);
      const p = list.filter((a) => a.status === "passed").length;
      const f = list.filter((a) => a.status === "failed").length;
      return {
        department: d.name,
        passed: p,
        failed: f,
        passPct: list.length ? Math.round((p / list.length) * 100) : 0,
        failPct: list.length ? Math.round((f / list.length) * 100) : 0,
      };
    })
    .filter((r) => matchesSearch(r.department, filters.search));

  return {
    ...catalogMeta("pass_fail"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "department", label: "Department" },
      { key: "passed", label: "Passed" },
      { key: "failed", label: "Failed" },
      { key: "passPct", label: "Pass %" },
      { key: "failPct", label: "Fail %" },
    ],
    rows: byDept,
    kpis: [
      { label: "Pass %", value: `${Math.round((pass / total) * 100)}%`, tone: "success" },
      { label: "Fail %", value: `${Math.round((fail / total) * 100)}%`, tone: "danger" },
      { label: "Graded", value: decided.length },
    ],
    charts: [
      {
        id: "overall",
        title: "Overall pass / fail",
        kind: "pie",
        data: [
          { name: "Pass", value: pass, fill: "hsl(152, 61%, 36%)" },
          { name: "Fail", value: fail, fill: "hsl(0, 72%, 51%)" },
        ],
      },
      {
        id: "dept",
        title: "Pass % by department",
        kind: "bar",
        data: byDept.map((r) => ({ name: r.department, value: r.passPct })),
      },
    ],
  };
}

function buildOverdue(filters: ReportFilters): ReportDataset {
  const rows = assignments(filters)
    .filter(isOverdue)
    .map((a) => ({
      employee: empName(a.employeeId),
      employeeCode: empCode(a.employeeId),
      department: deptName(a.departmentId),
      sop: sopLabel(a.sopId),
      status: a.status,
      dueDate: a.dueDate ? formatDate(a.dueDate) : "—",
      daysOverdue: a.dueDate
        ? Math.max(
            0,
            Math.floor((today().getTime() - new Date(a.dueDate).getTime()) / 86400000)
          )
        : 0,
      trainer: trainerName(a.trainerId),
    }));

  return {
    ...catalogMeta("overdue_training"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "employee", label: "Employee" },
      { key: "department", label: "Department" },
      { key: "sop", label: "SOP" },
      { key: "status", label: "Status" },
      { key: "dueDate", label: "Due" },
      { key: "daysOverdue", label: "Days overdue" },
      { key: "trainer", label: "Trainer" },
    ],
    rows,
    kpis: [
      { label: "Overdue items", value: rows.length, tone: "danger" },
      {
        label: "Avg days late",
        value: rows.length
          ? Math.round(
              rows.reduce((s, r) => s + Number(r.daysOverdue), 0) / rows.length
            )
          : 0,
        tone: "warning",
      },
    ],
    charts: [
      {
        id: "dept",
        title: "Overdue by department",
        kind: "bar",
        data: Object.entries(
          rows.reduce<Record<string, number>>((acc, r) => {
            acc[String(r.department)] = (acc[String(r.department)] || 0) + 1;
            return acc;
          }, {})
        ).map(([name, value]) => ({ name, value })),
      },
    ],
  };
}

function buildUpcomingExpiry(filters: ReportFilters): ReportDataset {
  const now = today();
  const certs = data()
    .certificates.filter((c) => !c.isRevoked)
    .map((c) => ({
      type: "Certificate",
      reference: c.certificateNumber,
      subject: c.employeeName,
      department: c.departmentName,
      item: c.sopNumber,
      expiry: c.expiresAt
        ? formatDate(c.expiresAt)
        : formatDate(
            new Date(new Date(c.issuedAt).getTime() + 365 * 86400000).toISOString()
          ),
      daysLeft: Math.floor(
        ((c.expiresAt
          ? new Date(c.expiresAt).getTime()
          : new Date(c.issuedAt).getTime() + 365 * 86400000) -
          now.getTime()) /
          86400000
      ),
    }));

  const sops = allSops()
    .filter((s) => s.reviewDate)
    .map((s) => ({
      type: "SOP review",
      reference: s.sopNumber,
      subject: s.title,
      department: s.departmentIds.map(deptCode).join(", "),
      item: s.sopNumber,
      expiry: formatDate(s.reviewDate),
      daysLeft: Math.floor(
        (new Date(s.reviewDate!).getTime() - now.getTime()) / 86400000
      ),
    }));

  const rows = [...certs, ...sops]
    .filter((r) => r.daysLeft >= 0 && r.daysLeft <= 180)
    .filter((r) =>
      matchesSearch(`${r.reference} ${r.subject} ${r.department}`, filters.search)
    )
    .filter((r) => {
      if (filters.departmentId === "all") return true;
      const name = deptName(filters.departmentId);
      const code = deptCode(filters.departmentId);
      return (
        String(r.department).includes(name) || String(r.department).includes(code)
      );
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    ...catalogMeta("upcoming_expiry"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "type", label: "Type" },
      { key: "reference", label: "Reference" },
      { key: "subject", label: "Subject" },
      { key: "department", label: "Department" },
      { key: "expiry", label: "Expiry / review" },
      { key: "daysLeft", label: "Days left" },
    ],
    rows,
    kpis: [
      { label: "Within 180 days", value: rows.length, tone: "warning" },
      {
        label: "≤ 30 days",
        value: rows.filter((r) => r.daysLeft <= 30).length,
        tone: "danger",
      },
    ],
    charts: [
      {
        id: "bucket",
        title: "Expiry window",
        kind: "bar",
        data: [
          { name: "≤30d", value: rows.filter((r) => r.daysLeft <= 30).length },
          {
            name: "31-90d",
            value: rows.filter((r) => r.daysLeft > 30 && r.daysLeft <= 90).length,
          },
          {
            name: "91-180d",
            value: rows.filter((r) => r.daysLeft > 90 && r.daysLeft <= 180).length,
          },
        ],
      },
    ],
  };
}

function buildCertificateStatus(filters: ReportFilters): ReportDataset {
  const rows = data()
    .certificates.filter((c) => inDateRange(c.issuedAt, filters))
    .filter(
      (c) =>
        filters.departmentId === "all" || c.departmentId === filters.departmentId
    )
    .filter((c) =>
      matchesSearch(
        `${c.certificateNumber} ${c.employeeName} ${c.sopNumber} ${c.trainerName}`,
        filters.search
      )
    )
    .map((c) => ({
      number: c.certificateNumber,
      employee: c.employeeName,
      employeeCode: c.employeeCode,
      department: c.departmentName,
      sop: c.sopNumber,
      trainer: c.trainerName,
      score: `${c.percentage}%`,
      issued: formatDate(c.issuedAt),
      status: c.isRevoked ? "Revoked" : "Active",
      storage: c.pdfStoragePath ? "Stored" : "Pending",
    }));

  return {
    ...catalogMeta("certificate_status"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "number", label: "Certificate #" },
      { key: "employee", label: "Employee" },
      { key: "department", label: "Department" },
      { key: "sop", label: "SOP" },
      { key: "trainer", label: "Trainer" },
      { key: "score", label: "Score" },
      { key: "issued", label: "Issued" },
      { key: "status", label: "Status" },
      { key: "storage", label: "Storage" },
    ],
    rows,
    kpis: [
      { label: "Issued", value: rows.length },
      {
        label: "Active",
        value: rows.filter((r) => r.status === "Active").length,
        tone: "success",
      },
      {
        label: "Revoked",
        value: rows.filter((r) => r.status === "Revoked").length,
        tone: "danger",
      },
    ],
    charts: [
      {
        id: "status",
        title: "Certificate status",
        kind: "pie",
        data: [
          {
            name: "Active",
            value: rows.filter((r) => r.status === "Active").length,
            fill: "hsl(152, 61%, 36%)",
          },
          {
            name: "Revoked",
            value: rows.filter((r) => r.status === "Revoked").length,
            fill: "hsl(0, 72%, 51%)",
          },
        ],
      },
    ],
  };
}

function buildSopCoverage(filters: ReportFilters): ReportDataset {
  const asg = assignments({ ...filters, departmentId: "all" });
  const rows = allSops()
    .filter((s) => s.status === "approved" || s.status === "under_review")
    .filter((s) =>
      filters.departmentId === "all"
        ? true
        : s.departmentIds.includes(filters.departmentId)
    )
    .filter((s) => matchesSearch(`${s.sopNumber} ${s.title}`, filters.search))
    .map((s) => {
      const related = asg.filter((a) => a.sopId === s.id);
      const trained = related.filter((a) => a.status === "passed").length;
      const required = Math.max(
        related.length,
        allEmployees().filter((e) =>
          Boolean(e.departmentId && s.departmentIds.includes(e.departmentId))
        ).length
      );
      const coverage = required ? Math.round((trained / required) * 100) : 0;
      return {
        sop: s.sopNumber,
        title: s.title,
        status: s.status,
        departments: s.departmentIds.map(deptCode).join(", "),
        assigned: related.length,
        trained,
        required,
        coveragePct: coverage,
      };
    });

  return {
    ...catalogMeta("sop_coverage"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "sop", label: "SOP #" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "departments", label: "Departments" },
      { key: "assigned", label: "Assigned" },
      { key: "trained", label: "Trained" },
      { key: "required", label: "Required" },
      { key: "coveragePct", label: "Coverage %" },
    ],
    rows,
    kpis: [
      {
        label: "Avg coverage",
        value: rows.length
          ? `${Math.round(rows.reduce((s, r) => s + r.coveragePct, 0) / rows.length)}%`
          : "0%",
      },
      { label: "SOPs", value: rows.length },
    ],
    charts: [
      {
        id: "coverage",
        title: "SOP coverage %",
        kind: "bar",
        data: rows.map((r) => ({ name: r.sop, value: r.coveragePct })),
      },
    ],
  };
}

function buildTrainingMatrix(filters: ReportFilters): ReportDataset {
  const employees = scopeMatrixEmployees(
    allEmployees(),
    filters.departmentId === "all" ? undefined : filters.departmentId
  );
  const sops = filterMatrixSops(
    allSops(),
    filters.departmentId === "all" ? undefined : filters.departmentId
  );
  const asg = latestAssignmentsByCell(allAssignments());

  const rows = employees
    .filter((e) =>
      matchesSearch(`${e.firstName} ${e.lastName} ${e.employeeCode}`, filters.search)
    )
    .map((e) => {
      const row: Record<string, string | number | boolean | null> = {
        employee: `${e.firstName} ${e.lastName}`,
        employeeCode: e.employeeCode,
        department: deptName(e.departmentId),
      };
      for (const s of sops) {
        const a = resolveLatestAssignment(asg, e.id, s.id);
        row[s.sopNumber] = matrixCellLabel(matrixCellStatus(a, s));
      }
      return row;
    });

  return {
    ...catalogMeta("training_matrix"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "employee", label: "Employee" },
      { key: "employeeCode", label: "ID" },
      { key: "department", label: "Department" },
      ...sops.map((s) => ({ key: s.sopNumber, label: s.sopNumber })),
    ],
    rows,
    kpis: [
      { label: "Employees", value: rows.length },
      { label: "SOPs", value: sops.length },
      {
        label: "Cells trained",
        value: rows.reduce(
          (acc, r) => acc + sops.filter((s) => r[s.sopNumber] === "Pass").length,
          0
        ),
        tone: "success",
      },
    ],
    charts: [
      {
        id: "coverage",
        title: "Trained cells by SOP",
        kind: "bar",
        data: sops.map((s) => ({
          name: s.sopNumber,
          value: rows.filter((r) => r[s.sopNumber] === "Pass").length,
        })),
      },
    ],
  };
}

function buildAuditReport(filters: ReportFilters): ReportDataset {
  const rows = allAudit()
    .filter((a) => inDateRange(a.timestamp, filters))
    .filter((a) =>
      matchesSearch(
        `${a.actorEmail} ${a.action} ${a.resourceType} ${a.description}`,
        filters.search
      )
    )
    .map((a) => ({
      timestamp: formatDate(a.timestamp),
      actor: a.actorEmail,
      role: a.actorRole || "—",
      action: a.action,
      resource: a.resourceType,
      resourceId: a.resourceId,
      description: a.description,
    }));

  return {
    ...catalogMeta("audit_report"),
    generatedAt: new Date().toISOString(),
    columns: [
      { key: "timestamp", label: "When" },
      { key: "actor", label: "Actor" },
      { key: "role", label: "Role" },
      { key: "action", label: "Action" },
      { key: "resource", label: "Resource" },
      { key: "resourceId", label: "ID" },
      { key: "description", label: "Description" },
    ],
    rows,
    kpis: [
      { label: "Events", value: rows.length },
      {
        label: "Actors",
        value: new Set(rows.map((r) => r.actor)).size,
      },
    ],
    charts: [
      {
        id: "actions",
        title: "Actions",
        kind: "pie",
        data: Object.entries(
          rows.reduce<Record<string, number>>((acc, r) => {
            acc[String(r.action)] = (acc[String(r.action)] || 0) + 1;
            return acc;
          }, {})
        ).map(([name, value]) => ({ name, value })),
      },
    ],
  };
}

function buildFromType(type: ReportType, filters: ReportFilters): ReportDataset {
  switch (type) {
    case "employee_training":
      return buildEmployeeTraining(filters);
    case "department_compliance":
      return buildDepartmentCompliance(filters);
    case "trainer_performance":
      return buildTrainerPerformance(filters);
    case "exam_results":
      return buildExamResults(filters);
    case "pass_fail":
      return buildPassFail(filters);
    case "overdue_training":
      return buildOverdue(filters);
    case "upcoming_expiry":
      return buildUpcomingExpiry(filters);
    case "certificate_status":
      return buildCertificateStatus(filters);
    case "sop_coverage":
      return buildSopCoverage(filters);
    case "training_matrix":
      return buildTrainingMatrix(filters);
    case "audit_report":
      return buildAuditReport(filters);
    default:
      return buildEmployeeTraining(filters);
  }
}

/** Load Firestore data and build a report dataset. */
export async function buildReport(
  type: ReportType,
  filters: ReportFilters,
  snapshot?: ReportSnapshot
): Promise<ReportDataset> {
  snap = snapshot ?? (await loadReportSnapshot());
  try {
    return buildFromType(type, filters);
  } finally {
    if (!snapshot) snap = null;
  }
}

export function emptyFilters(departmentId?: string): ReportFilters {
  const now = new Date();
  const y = now.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    search: "",
    departmentId: departmentId || "all",
    dateFrom: `${y}-01-01`,
    dateTo: `${y}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
}

export type { ChartPoint, ReportSnapshot };
