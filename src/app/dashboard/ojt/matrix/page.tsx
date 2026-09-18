"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { useDepartments } from "@/hooks/use-departments";
import { listEmployeesForLifecycle } from "@/lib/services/lifecycle";
import {
  ensureOjtFormDocument,
  getOjtFormDocument,
  getOjtSettings,
  listOjtAssignments,
  listOjtPlans,
  seedPlannerFromTopics,
  setPlanEmployeeApplicability,
} from "@/lib/services/ojt";
import { toOjtActor } from "@/lib/ojt/actor";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import { currentCalendarYear, OJT_MATRIX_LABELS } from "@/lib/ojt/constants";
import { printOjtMatrixForm } from "@/lib/ojt/print";
import {
  employeeDisplayName,
  latestAssignmentForCell,
  matrixCellIsLocked,
  matrixCellValue,
  officialExecutionLabel,
  officialSelectionLabel,
  officialSelectionValue,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OjtEmptyState } from "@/components/ojt/ojt-empty-state";
import { OjtMatrixLegend } from "@/components/ojt/ojt-legend";
import { OjtPageHint } from "@/components/ojt/ojt-page-hint";
import { OjtFormApprovalPanel } from "@/components/ojt/ojt-form-approvals";
import { cn } from "@/lib/utils";
import type { Employee } from "@/types";
import type { OjtAssignment, OjtFormDocument, OjtMatrixCellValue, OjtPlan, OjtSettings } from "@/types/ojt";

export default function OjtMatrixPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { activeDepartments } = useDepartments();
  const canAssign = profile?.role ? hasPermission(profile.role, "ojt:assign") : false;
  const searchParams = useSearchParams();
  const deptLocked = profile?.role === "department_head" ? profile.departmentId : undefined;
  const [year, setYear] = useState(() => searchParams.get("year") || String(currentCalendarYear()));
  const [departmentId, setDepartmentId] = useState(
    () => deptLocked || searchParams.get("departmentId") || ""
  );
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plans, setPlans] = useState<OjtPlan[]>([]);
  const [assignments, setAssignments] = useState<OjtAssignment[]>([]);
  const [form, setForm] = useState<OjtFormDocument | null>(null);
  const [settings, setSettings] = useState<OjtSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ plan: OjtPlan; employee: Employee } | null>(null);

  const locked = Boolean(form?.locked);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const dept = deptLocked || departmentId;
      const [emps, planRows, asg, formRow, cfg] = await Promise.all([
        listEmployeesForLifecycle().catch(() => [] as Employee[]),
        listOjtPlans({
          year: Number(year),
          departmentId: dept || undefined,
        }),
        listOjtAssignments({
          year: Number(year),
          departmentId: dept || undefined,
        }),
        dept ? getOjtFormDocument("matrix", Number(year), dept) : Promise.resolve(null),
        getOjtSettings(),
      ]);
      setEmployees(emps);
      setPlans(planRows);
      setAssignments(asg);
      setForm(formRow);
      setSettings(cfg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load matrix");
    } finally {
      setLoading(false);
    }
  }, [departmentId, deptLocked, year]);

  useEffect(() => {
    if (deptLocked) {
      setDepartmentId(deptLocked);
      return;
    }
    const fromUrl = searchParams.get("departmentId");
    const yearFromUrl = searchParams.get("year");
    if (fromUrl) setDepartmentId(fromUrl);
    if (yearFromUrl) setYear(yearFromUrl);
  }, [deptLocked, searchParams]);

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
        values.push(matrixCellValue(plan, asg, emp.id, settings?.overdueGraceDays ?? 0));
      }
    }
    return summarizeMatrix(values);
  }, [plans, matrixEmployees, assignments, year, settings?.overdueGraceDays]);

  const applySelection = async (
    plan: OjtPlan,
    employee: Employee,
    applicability: "selected" | "not_applicable" | "not_set"
  ) => {
    if (!profile || !canAssign) return;
    if (locked) {
      toast.error("Approved matrix is controlled. Create a revision before changing cells.");
      return;
    }
    try {
      await setPlanEmployeeApplicability({
        planId: plan.id,
        employee,
        applicability,
        actor: toOjtActor(profile),
        trainerId: plan.trainerId,
        trainerName: plan.trainerName,
      });
      toast.success(
        applicability === "selected"
          ? `Assigned ${plan.trainingTopic} to ${employeeDisplayName(employee)}`
          : applicability === "not_applicable"
            ? `Marked NA for ${employeeDisplayName(employee)}`
            : "Selection cleared"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleCell = (plan: OjtPlan, employee: Employee) => {
    if (!profile || !canAssign) return;
    const asg = latestAssignmentForCell(assignments, employee.id, plan.topicId, Number(year));
    if (matrixCellIsLocked(asg)) {
      if (asg) router.push(`/dashboard/ojt/assignments/${asg.id}`);
      else toast.error("This cell already has an OJT record — open the assignment to change it");
      return;
    }
    if (locked) {
      toast.error("Approved matrix is controlled. Create a revision before changing cells.");
      return;
    }
    const current = officialSelectionValue(plan, employee.id);
    if (current === "empty") {
      setConfirm({ plan, employee });
      return;
    }
    if (current === "selected") {
      void applySelection(plan, employee, "not_applicable");
      return;
    }
    void applySelection(plan, employee, "not_set");
  };

  const handleSeed = async () => {
    if (!profile || !department) {
      toast.error("Select a department");
      return;
    }
    try {
      await seedPlannerFromTopics(Number(year), { id: department.id, name: department.name }, toOjtActor(profile));
      await ensureOjtFormDocument({
        kind: "matrix",
        year: Number(year),
        departmentId: department.id,
        departmentName: department.name,
        actor: toOjtActor(profile),
      });
      toast.success("Planner topics loaded — matrix rows are ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load topics");
    }
  };

  const exportMatrix = () => {
    const rows = plans.flatMap((plan) => {
      const s: Record<string, string> = {
        "S. No.": String(plans.indexOf(plan) + 1),
        "Training Topic": plan.trainingTopic,
        "SOP / Reference": plan.referenceDocumentNumber || plan.sopNumber || "NA",
        "S/E": "S",
      };
      const e: Record<string, string> = {
        "S. No.": "",
        "Training Topic": "",
        "SOP / Reference": "",
        "S/E": "E",
      };
      for (const emp of matrixEmployees) {
        const asg = latestAssignmentForCell(assignments, emp.id, plan.topicId, Number(year));
        const key = `${employeeDisplayName(emp)} (${emp.employeeCode})`;
        s[key] = officialSelectionLabel(officialSelectionValue(plan, emp.id));
        e[key] = officialExecutionLabel(plan, asg, emp.id);
      }
      return [s, e];
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OJT Matrix");
    XLSX.writeFile(wb, `ojt-matrix-${year}.xlsx`);
    toast.success("Matrix exported");
  };

  const handlePrint = () => {
    if (!settings || !department) {
      toast.error("Select a department first");
      return;
    }
    printOjtMatrixForm({
      plans,
      employees: matrixEmployees,
      assignments,
      departmentName: department.name,
      year: Number(year),
      settings,
      form,
      logoSrc: `${window.location.origin}/brand/skymap-logo.png`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Step 3 — Select people</h1>
          <p className="text-muted-foreground">
            Click under a name to say who needs each topic. ✓ = needs training. NA = not needed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!plans.length}>
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportMatrix}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>
      <OjtPageHint title="How to use this grid">
        First click under a name = ✓ (this person needs this training). Click again = NA (not needed).
        After ✓, go to Book date to pick the day. The green E row later shows the training date.
      </OjtPageHint>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Need training", cells.pending],
          ["Date booked", cells.scheduled],
          ["Finished", cells.completed],
          ["Late", cells.overdue],
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
            <CardDescription>Choose year and department, then click cells in the table below.</CardDescription>
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
            <>
              <Button variant="outline" onClick={() => void handleSeed()} disabled={locked}>
                Load planner topics
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/dashboard/ojt/schedule">Next: book a date →</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {department?.name || "Department"} · who needs training · {year}
          </CardTitle>
          <CardDescription>
            Click a name under a topic. ✓ = needs training. NA = not needed. The E row shows the date after you book it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OjtMatrixLegend />
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading matrix…
            </div>
          ) : !plans.length ? (
            <OjtEmptyState
              title="No yearly plan for this department"
              description="Go to Plan months first, load topics, then come back here to tick names."
              actionHref="/dashboard/ojt/planner"
              actionLabel="Open plan months"
            />
          ) : !matrixEmployees.length ? (
            <OjtEmptyState
              title="No employees in this department"
              description="Active employees appear as columns once they are handed over to the department."
            />
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 top-0 z-30 min-w-[56px] bg-background">S. No.</TableHead>
                    <TableHead className="sticky left-[56px] top-0 z-30 min-w-[220px] bg-background">Training Topic</TableHead>
                    <TableHead className="sticky top-0 z-20 min-w-[120px] bg-background">SOP / Reference</TableHead>
                    <TableHead className="sticky top-0 z-20 w-16 bg-background text-center">Row</TableHead>
                    {matrixEmployees.map((e) => (
                      <TableHead key={e.id} className="sticky top-0 z-20 min-w-[120px] bg-background text-center text-xs">
                        <div>{employeeDisplayName(e)}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{e.employeeCode}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan, index) => (
                    <Fragment key={plan.id}>
                      <TableRow>
                        <TableCell className="sticky left-0 z-10 bg-background" rowSpan={2}>
                          {index + 1}
                        </TableCell>
                        <TableCell className="sticky left-[56px] z-10 bg-background font-medium" rowSpan={2}>
                          {plan.trainingTopic}
                        </TableCell>
                        <TableCell className="font-mono text-xs" rowSpan={2}>
                          {plan.referenceDocumentNumber || plan.sopNumber || "NA"}
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold text-sky-800 dark:text-sky-200">S</TableCell>
                        {matrixEmployees.map((emp) => {
                          const asg = latestAssignmentForCell(assignments, emp.id, plan.topicId, Number(year));
                          const official = officialSelectionValue(plan, emp.id);
                          const label = officialSelectionLabel(official);
                          const workflow = matrixCellValue(plan, asg, emp.id, settings?.overdueGraceDays ?? 0);
                          const lockedCell = matrixCellIsLocked(asg);
                          return (
                            <TableCell key={`s-${emp.id}`} className="text-center">
                              <button
                                type="button"
                                disabled={!canAssign && !lockedCell}
                                onClick={() => handleCell(plan, emp)}
                                title={
                                  lockedCell
                                    ? `Open record · ${OJT_MATRIX_LABELS[workflow]}`
                                    : official === "empty"
                                      ? "Click to select (✓)"
                                      : official === "selected"
                                        ? "Click to mark NA"
                                        : "Click to clear"
                                }
                                className={cn(
                                  "h-8 min-w-[3rem] rounded-md px-2 text-xs font-semibold",
                                  official === "selected" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                                  official === "not_applicable" && "bg-muted text-muted-foreground",
                                  official === "empty" && "bg-muted/40 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {label || "·"}
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-center text-xs font-semibold text-emerald-800 dark:text-emerald-200">E</TableCell>
                        {matrixEmployees.map((emp) => {
                          const asg = latestAssignmentForCell(assignments, emp.id, plan.topicId, Number(year));
                          const official = officialSelectionValue(plan, emp.id);
                          const dateLabel = officialExecutionLabel(plan, asg, emp.id);
                          const workflow = matrixCellValue(plan, asg, emp.id, settings?.overdueGraceDays ?? 0);
                          return (
                            <TableCell key={`e-${emp.id}`} className="text-center">
                              {asg && official !== "not_applicable" ? (
                                <button
                                  type="button"
                                  onClick={() => router.push(`/dashboard/ojt/assignments/${asg.id}`)}
                                  title={`Workflow: ${OJT_MATRIX_LABELS[workflow]}`}
                                  className="h-8 min-w-[3rem] rounded-md px-1 text-[10px] font-medium text-emerald-800 hover:bg-emerald-500/10 dark:text-emerald-200"
                                >
                                  {dateLabel || "·"}
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">{dateLabel || "·"}</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {department && profile && (
        <OjtFormApprovalPanel
          kind="matrix"
          year={Number(year)}
          departmentId={department.id}
          departmentName={department.name}
          form={form}
          onChanged={() => refresh({ silent: true })}
        />
      )}

      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give this training to this person?</DialogTitle>
            <DialogDescription>
              {confirm
                ? `This will create a record: “${confirm.plan.trainingTopic}” for ${employeeDisplayName(confirm.employee)} (${confirm.employee.employeeCode}). Next you can book a date.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!confirm) return;
                const { plan, employee } = confirm;
                setConfirm(null);
                void applySelection(plan, employee, "selected");
              }}
            >
              Yes, assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
