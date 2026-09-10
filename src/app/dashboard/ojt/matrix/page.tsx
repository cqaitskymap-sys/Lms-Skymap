"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { useDepartments } from "@/hooks/use-departments";
import { listEmployeesForLifecycle } from "@/lib/services/lifecycle";
import {
  listOjtAssignments,
  listOjtPlans,
  seedPlannerFromTopics,
  setPlanEmployeeApplicability,
} from "@/lib/services/ojt";
import { toOjtActor } from "@/lib/ojt/actor";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import { currentCalendarYear } from "@/lib/ojt/constants";
import { OJT_MATRIX_LABELS } from "@/lib/ojt/constants";
import {
  latestAssignmentForCell,
  matrixCellValue,
  scopeOjtEmployees,
  summarizeMatrix,
} from "@/lib/ojt/matrix";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OjtEmptyState } from "@/components/ojt/ojt-empty-state";
import { OjtMatrixLegend, MATRIX_CELL_CLASS } from "@/components/ojt/ojt-legend";
import { cn } from "@/lib/utils";
import type { Employee } from "@/types";
import type { OjtApplicability, OjtAssignment, OjtMatrixCellValue, OjtPlan } from "@/types/ojt";

function cycleApplicability(current: OjtMatrixCellValue): OjtApplicability | "not_set" {
  if (current === "not_set") return "selected";
  if (current === "not_applicable") return "not_set";
  return "not_applicable";
}

export default function OjtMatrixPage() {
  const { profile } = useAuth();
  const { activeDepartments } = useDepartments();
  const canAssign = profile?.role ? hasPermission(profile.role, "ojt:assign") : false;
  const deptLocked = profile?.role === "department_head" ? profile.departmentId : undefined;
  const [year, setYear] = useState(String(currentCalendarYear()));
  const [departmentId, setDepartmentId] = useState(deptLocked || "");
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plans, setPlans] = useState<OjtPlan[]>([]);
  const [assignments, setAssignments] = useState<OjtAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const dept = deptLocked || departmentId;
      const [emps, planRows, asg] = await Promise.all([
        listEmployeesForLifecycle().catch(() => [] as Employee[]),
        listOjtPlans({
          year: Number(year),
          departmentId: dept || undefined,
        }),
        listOjtAssignments({
          year: Number(year),
          departmentId: dept || undefined,
        }),
      ]);
      setEmployees(emps);
      setPlans(planRows);
      setAssignments(asg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load matrix");
    } finally {
      setLoading(false);
    }
  }, [departmentId, deptLocked, year]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh({ silent: true });
    window.addEventListener(OJT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(OJT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const department = useMemo(
    () => activeDepartments.find((d) => d.id === (deptLocked || departmentId)),
    [activeDepartments, departmentId, deptLocked]
  );

  const matrixEmployees = useMemo(() => {
    const rows = scopeOjtEmployees(employees, deptLocked || departmentId || undefined);
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e) =>
      `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(q)
    );
  }, [employees, deptLocked, departmentId, search]);

  const cells = useMemo(() => {
    const values: OjtMatrixCellValue[] = [];
    for (const plan of plans) {
      for (const emp of matrixEmployees) {
        const asg = latestAssignmentForCell(assignments, emp.id, plan.topicId, Number(year));
        values.push(matrixCellValue(plan, asg, emp.id));
      }
    }
    return summarizeMatrix(values);
  }, [plans, matrixEmployees, assignments, year]);

  const handleCell = async (plan: OjtPlan, employee: Employee, current: OjtMatrixCellValue) => {
    if (!profile || !canAssign) return;
    if (["completed", "in_progress", "scheduled", "failed", "retraining_required", "overdue"].includes(current)) {
      toast.error("This cell already has an OJT record — open the assignment to change it");
      return;
    }
    const next = cycleApplicability(current);
    try {
      await setPlanEmployeeApplicability({
        planId: plan.id,
        employee,
        applicability: next,
        actor: toOjtActor(profile),
        trainerId: plan.trainerId,
        trainerName: plan.trainerName,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleSeed = async () => {
    if (!profile || !department) {
      toast.error("Select a department");
      return;
    }
    try {
      await seedPlannerFromTopics(Number(year), { id: department.id, name: department.name }, toOjtActor(profile));
      toast.success("Planner topics loaded — matrix rows are ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load topics");
    }
  };

  const exportMatrix = () => {
    const rows = plans.map((plan) => {
      const row: Record<string, string> = {
        "Training Topic": plan.trainingTopic,
        "SOP / Reference": plan.referenceDocumentNumber || plan.sopNumber || "NA",
      };
      for (const emp of matrixEmployees) {
        const asg = latestAssignmentForCell(assignments, emp.id, plan.topicId, Number(year));
        const value = matrixCellValue(plan, asg, emp.id);
        row[`${emp.firstName} ${emp.lastName}`] = OJT_MATRIX_LABELS[value];
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OJT Matrix");
    XLSX.writeFile(wb, `ojt-matrix-${year}.xlsx`);
    toast.success("Matrix exported");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Who needs this OJT?</h1>
          <p className="text-muted-foreground">
            Each column is an employee. Click an empty cell to select them (✓), again for NA, again to clear.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportMatrix}>
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Selected / pending", cells.pending],
          ["Scheduled", cells.scheduled],
          ["Completed", cells.completed],
          ["Overdue", cells.overdue],
          ["Failed", cells.failed],
          ["Retraining", cells.retraining],
          ["NA", cells.na],
          ["Cells", cells.total],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find people</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Year</Label>
            <Input type="number" className="w-28" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Department</Label>
            <Select
              value={deptLocked || departmentId || undefined}
              onValueChange={setDepartmentId}
              disabled={Boolean(deptLocked)}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {activeDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Employee search</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or code" />
          </div>
          {canAssign && (
            <Button variant="outline" onClick={() => void handleSeed()}>
              Load planner topics
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {department?.name || "Department"} employee training matrix · {year}
          </CardTitle>
          <CardDescription>
            Locked cells (scheduled / completed / failed) open the training record instead of cycling.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          <OjtMatrixLegend />
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading matrix…
            </div>
          ) : !plans.length ? (
            <OjtEmptyState
              title="No yearly plan for this department"
              description="Load topics into the yearly plan first, then come back here to tick who needs each activity."
              actionHref="/dashboard/ojt/planner"
              actionLabel="Open yearly plan"
            />
          ) : !matrixEmployees.length ? (
            <OjtEmptyState
              title="No employees in this department"
              description="Active employees appear as columns once they are handed over to the department."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-[220px] bg-background">Training Topic</TableHead>
                  <TableHead className="min-w-[120px]">SOP / Reference</TableHead>
                  {matrixEmployees.map((e) => (
                    <TableHead key={e.id} className="min-w-[110px] text-center text-xs">
                      <div>{e.firstName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{e.employeeCode}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="sticky left-0 z-10 bg-background font-medium">
                      {plan.trainingTopic}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {plan.referenceDocumentNumber || plan.sopNumber || "NA"}
                    </TableCell>
                    {matrixEmployees.map((emp) => {
                      const asg = latestAssignmentForCell(
                        assignments,
                        emp.id,
                        plan.topicId,
                        Number(year)
                      );
                      const value = matrixCellValue(plan, asg, emp.id);
                      const label = OJT_MATRIX_LABELS[value];
                      return (
                        <TableCell key={emp.id} className="text-center">
                          {asg &&
                          (["completed", "in_progress", "scheduled", "failed", "retraining_required", "overdue"].includes(
                            value
                          ) ||
                            !["selected", "draft", "assigned", "cancelled"].includes(asg.status)) ? (
                            <Link
                              href={`/dashboard/ojt/assignments/${asg.id}`}
                              className={cn(
                                "inline-flex h-8 min-w-[3rem] items-center justify-center rounded-md px-2 text-xs font-semibold",
                                MATRIX_CELL_CLASS[value]
                              )}
                            >
                              {label}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled={!canAssign}
                              onClick={() => void handleCell(plan, emp, value)}
                              title="Click: select → NA → clear"
                              className={cn(
                                "h-8 min-w-[3rem] rounded-md px-2 text-xs font-semibold",
                                MATRIX_CELL_CLASS[value]
                              )}
                            >
                              {label}
                            </button>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
