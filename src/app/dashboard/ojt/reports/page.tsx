"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { listAuditLogs } from "@/lib/services/audit-logs";
import { listOjtAssignments, listOjtPlans, getOjtSettings } from "@/lib/services/ojt";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import { currentCalendarYear, monthName } from "@/lib/ojt/constants";
import { isOjtOverdue } from "@/lib/ojt/workflow";
import { OJT_MATRIX_LABELS } from "@/lib/ojt/constants";
import { latestAssignmentForCell, matrixCellValue, scopeOjtEmployees } from "@/lib/ojt/matrix";
import { listEmployeesForLifecycle } from "@/lib/services/lifecycle";
import { ReportExportMenu } from "@/components/reports/report-export-menu";
import { ReportTable } from "@/components/reports/report-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportDataset, ReportType } from "@/lib/reports/types";
import type { OjtAssignment } from "@/types/ojt";
import type { Employee } from "@/types";

type OjtReportId =
  | "ojt_employee"
  | "ojt_department"
  | "ojt_sop"
  | "ojt_trainer"
  | "ojt_monthly_planner"
  | "ojt_matrix"
  | "ojt_pending"
  | "ojt_overdue"
  | "ojt_failed"
  | "ojt_completed"
  | "ojt_competency"
  | "ojt_audit";

const CATALOG: { id: OjtReportId; title: string; description: string }[] = [
  { id: "ojt_employee", title: "Employee OJT Report", description: "Assignments and status per employee" },
  { id: "ojt_department", title: "Department OJT Report", description: "Completion by department" },
  { id: "ojt_sop", title: "SOP-wise OJT Report", description: "Coverage by SOP / reference" },
  { id: "ojt_trainer", title: "Trainer-wise OJT Report", description: "Delivery load by trainer" },
  { id: "ojt_monthly_planner", title: "Monthly OJT Planner", description: "Selection and execution months" },
  { id: "ojt_matrix", title: "OJT Training Matrix", description: "Employee × topic cells" },
  { id: "ojt_pending", title: "Pending OJT Report", description: "Not yet completed" },
  { id: "ojt_overdue", title: "Overdue OJT Report", description: "Past planned execution month" },
  { id: "ojt_failed", title: "Failed / Retraining Report", description: "Competency failures" },
  { id: "ojt_completed", title: "Completed OJT Report", description: "Closed practical training" },
  { id: "ojt_competency", title: "Employee Competency History", description: "Attempt history" },
  { id: "ojt_audit", title: "OJT Audit Report", description: "Audit trail for OJT records" },
];

function assignmentRow(a: OjtAssignment) {
  return {
    employee: a.employeeName,
    code: a.employeeCode,
    department: a.departmentName || "",
    topic: a.trainingTopic,
    sop: a.sopNumber || a.referenceDocumentNumber || "NA",
    version: a.sopVersionNumber || "",
    trainer: a.trainerName || "",
    status: a.status,
    selection: monthName(a.selectionMonth),
    execution: monthName(a.plannedExecutionMonth),
    date: a.actualExecutionDate?.slice(0, 10) || "",
  };
}

export default function OjtReportsPage() {
  const { profile, role } = useAuth();
  const canExport = !!role && (hasPermission(role, "ojt:export") || hasPermission(role, "reports:export"));
  const canAudit = !!role && hasPermission(role, "audit:read");
  const [type, setType] = useState<OjtReportId>("ojt_employee");
  const [assignments, setAssignments] = useState<OjtAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [graceDays, setGraceDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const year = currentCalendarYear();

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      if (profile?.role === "employee" && !profile.employeeId) {
        setAssignments([]);
        setEmployees([]);
        return;
      }
      const filters =
        profile?.role === "department_head" && profile.departmentId
          ? { departmentId: profile.departmentId }
          : profile?.role === "employee" && profile.employeeId
            ? { employeeId: profile.employeeId }
            : undefined;
      const [asg, emps, cfg] = await Promise.all([
        listOjtAssignments(filters),
        listEmployeesForLifecycle().catch(() => [] as Employee[]),
        getOjtSettings().catch(() => null),
      ]);
      setAssignments(asg);
      setEmployees(emps);
      setGraceDays(cfg?.overdueGraceDays ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load OJT reports");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh({ silent: true });
    window.addEventListener(OJT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(OJT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const dataset: ReportDataset | null = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (a: OjtAssignment) =>
      !q ||
      `${a.employeeName} ${a.employeeCode} ${a.trainingTopic} ${a.sopNumber || ""} ${a.trainerName || ""}`
        .toLowerCase()
        .includes(q);

    const columns = [
      { key: "employee", label: "Employee" },
      { key: "code", label: "Code" },
      { key: "department", label: "Department" },
      { key: "topic", label: "Topic" },
      { key: "sop", label: "SOP / Reference" },
      { key: "version", label: "SOP version" },
      { key: "trainer", label: "Trainer" },
      { key: "status", label: "Status" },
      { key: "selection", label: "Selection month" },
      { key: "execution", label: "Execution month" },
      { key: "date", label: "Execution date" },
    ];
    const meta = CATALOG.find((c) => c.id === type)!;
    let rows: Record<string, string | number | boolean | null>[] = [];

    if (type === "ojt_pending") {
      rows = assignments.filter((a) => match(a) && !["completed", "cancelled"].includes(a.status)).map(assignmentRow);
    } else if (type === "ojt_overdue") {
      rows = assignments.filter((a) => match(a) && isOjtOverdue(a, new Date(), graceDays)).map(assignmentRow);
    } else if (type === "ojt_failed") {
      rows = assignments
        .filter((a) => match(a) && (a.status === "failed" || a.status === "retraining_required"))
        .map(assignmentRow);
    } else if (type === "ojt_completed") {
      rows = assignments.filter((a) => match(a) && a.status === "completed").map(assignmentRow);
    } else if (type === "ojt_competency") {
      rows = assignments.filter(match).flatMap((a) =>
        (a.attempts || []).map((att) => ({
          employee: a.employeeName,
          code: a.employeeCode,
          department: a.departmentName || "",
          topic: a.trainingTopic,
          sop: a.sopNumber || a.referenceDocumentNumber || "NA",
          version: a.sopVersionNumber || "",
          trainer: att.trainerName || a.trainerName || "",
          status: att.outcome,
          selection: String(att.attemptNumber),
          execution: "",
          date: att.executionDate?.slice(0, 10) || "",
        }))
      );
    } else if (type === "ojt_department") {
      const map = new Map<string, { total: number; completed: number }>();
      for (const a of assignments.filter(match)) {
        const key = a.departmentName || a.departmentId;
        const row = map.get(key) || { total: 0, completed: 0 };
        if (a.status !== "cancelled") row.total += 1;
        if (a.status === "completed") row.completed += 1;
        map.set(key, row);
      }
      rows = [...map.entries()].map(([name, v]) => ({
        employee: name,
        code: "",
        department: name,
        topic: "",
        sop: "",
        version: "",
        trainer: "",
        status: `${v.completed}/${v.total}`,
        selection: "",
        execution: "",
        date: "",
      }));
    } else if (type === "ojt_sop") {
      const map = new Map<string, { total: number; completed: number }>();
      for (const a of assignments.filter(match)) {
        const key = a.sopNumber || a.referenceDocumentNumber || "NA";
        const row = map.get(key) || { total: 0, completed: 0 };
        if (a.status !== "cancelled") row.total += 1;
        if (a.status === "completed") row.completed += 1;
        map.set(key, row);
      }
      rows = [...map.entries()].map(([sop, v]) => ({
        employee: "",
        code: "",
        department: "",
        topic: "",
        sop,
        version: "",
        trainer: "",
        status: `${v.completed}/${v.total}`,
        selection: "",
        execution: "",
        date: "",
      }));
    } else if (type === "ojt_trainer") {
      const map = new Map<string, { total: number; completed: number }>();
      for (const a of assignments.filter(match)) {
        const key = a.trainerName || "Unassigned";
        const row = map.get(key) || { total: 0, completed: 0 };
        if (a.status !== "cancelled") row.total += 1;
        if (a.status === "completed") row.completed += 1;
        map.set(key, row);
      }
      rows = [...map.entries()].map(([trainer, v]) => ({
        employee: "",
        code: "",
        department: "",
        topic: "",
        sop: "",
        version: "",
        trainer,
        status: `${v.completed}/${v.total}`,
        selection: "",
        execution: "",
        date: "",
      }));
    } else {
      rows = assignments.filter(match).map(assignmentRow);
    }

    return {
      type: "employee_training" as ReportType,
      title: meta.title,
      description: meta.description,
      generatedAt: new Date().toISOString(),
      columns,
      rows,
      kpis: [
        { label: "Rows", value: rows.length },
        { label: "Year", value: year },
      ],
      charts: [],
    };
  }, [assignments, search, type, year, graceDays]);

  const loadSpecial = useCallback(async () => {
    if (type === "ojt_monthly_planner") {
      const dept = profile?.role === "department_head" ? profile.departmentId : undefined;
      const plans = await listOjtPlans({ year, departmentId: dept });
      return {
        type: "training_matrix" as ReportType,
        title: "Monthly OJT Planner",
        description: "S = selection, E = execution",
        generatedAt: new Date().toISOString(),
        columns: [
          { key: "topic", label: "Training Topic" },
          { key: "sop", label: "SOP / Reference" },
          { key: "selection", label: "Selection months" },
          { key: "execution", label: "Execution months" },
          { key: "trainer", label: "Trainer" },
          { key: "status", label: "Status" },
        ],
        rows: plans.flatMap((p, index) => [
          {
            topic: p.trainingTopic,
            sop: p.referenceDocumentNumber || p.sopNumber || "NA",
            selection: "S",
            execution: p.selectionMonths.map(monthName).join(", "),
            trainer: p.trainerName || "",
            status: `${index + 1}`,
          },
          {
            topic: "",
            sop: "",
            selection: "E",
            execution: p.executionMonths.map(monthName).join(", "),
            trainer: "",
            status: p.status,
          },
        ]),
        kpis: [{ label: "Planner rows", value: plans.length }],
        charts: [],
      } satisfies ReportDataset;
    }
    if (type === "ojt_matrix") {
      const dept = profile?.role === "department_head" ? profile.departmentId : undefined;
      const [plans] = await Promise.all([
        listOjtPlans({ year, departmentId: dept }),
      ]);
      const emps = scopeOjtEmployees(employees, dept);
      const rows = plans.map((plan) => {
        const row: Record<string, string | number | boolean | null> = {
          topic: plan.trainingTopic,
          sop: plan.referenceDocumentNumber || plan.sopNumber || "NA",
        };
        for (const emp of emps) {
          const asg = latestAssignmentForCell(assignments, emp.id, plan.topicId, year);
          row[emp.employeeCode] = OJT_MATRIX_LABELS[matrixCellValue(plan, asg, emp.id, graceDays)];
        }
        return row;
      });
      return {
        type: "training_matrix" as ReportType,
        title: "OJT Training Matrix",
        description: "Employee-wise applicability",
        generatedAt: new Date().toISOString(),
        columns: [
          { key: "topic", label: "Training Topic" },
          { key: "sop", label: "SOP / Reference" },
          ...emps.map((e) => ({ key: e.employeeCode, label: `${e.firstName} ${e.lastName} (${e.employeeCode})` })),
        ],
        rows,
        kpis: [{ label: "Topics", value: plans.length }],
        charts: [],
      } satisfies ReportDataset;
    }
    if (type === "ojt_audit" && canAudit) {
      const logs = await listAuditLogs({ resourceType: "ojt_assignment", max: 500 });
      const topicLogs = await listAuditLogs({ resourceType: "ojt_plan", max: 200 });
      const all = [...logs, ...topicLogs];
      return {
        type: "audit_report" as ReportType,
        title: "OJT Audit Report",
        description: "Create, assignment, execution, approval and export events",
        generatedAt: new Date().toISOString(),
        columns: [
          { key: "timestamp", label: "Timestamp" },
          { key: "actor", label: "Actor" },
          { key: "action", label: "Action" },
          { key: "resource", label: "Resource" },
          { key: "description", label: "Description" },
        ],
        rows: all.map((l) => ({
          timestamp: l.timestamp,
          actor: l.actorEmail,
          action: l.action,
          resource: `${l.resourceType}:${l.resourceId}`,
          description: l.description,
        })),
        kpis: [{ label: "Events", value: all.length }],
        charts: [],
      } satisfies ReportDataset;
    }
    return null;
  }, [assignments, canAudit, employees, profile, type, year, graceDays]);

  const [special, setSpecial] = useState<ReportDataset | null>(null);

  useEffect(() => {
    if (type === "ojt_monthly_planner" || type === "ojt_matrix" || type === "ojt_audit") {
      void loadSpecial()
        .then(setSpecial)
        .catch((err) => toast.error(err instanceof Error ? err.message : "Report failed"));
    } else {
      setSpecial(null);
    }
  }, [loadSpecial, type]);

  const active = special || dataset;
  const catalog = CATALOG.filter((c) => c.id !== "ojt_audit" || canAudit);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">OJT reports</h1>
          <p className="text-muted-foreground">Pick a report type below, then export if you need a file.</p>
        </div>
        {active && canExport && <ReportExportMenu dataset={active} />}
      </div>
      <div className="flex flex-wrap gap-2">
        {catalog.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={type === c.id ? "default" : "outline"}
            onClick={() => setType(c.id)}
          >
            {c.title}
          </Button>
        ))}
      </div>
      <Input
        className="max-w-sm"
        placeholder="Filter employee, SOP, trainer…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading || !active ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
        </div>
      ) : (
        <ReportTable dataset={active} />
      )}
    </div>
  );
}
