"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { useDepartments } from "@/hooks/use-departments";
import {
  deleteOjtPlan,
  ensureOjtFormDocument,
  getOjtFormDocument,
  getOjtSettings,
  listOjtPlans,
  listOjtStaffOptions,
  seedPlannerFromTopics,
  upsertOjtPlan,
} from "@/lib/services/ojt";
import { toOjtActor } from "@/lib/ojt/actor";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import {
  CALENDAR_MONTHS,
  currentCalendarMonth,
  currentCalendarYear,
  formatRevisionNumber,
  toggleMonthList,
} from "@/lib/ojt/constants";
import { printOjtPlannerForm } from "@/lib/ojt/print";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { OjtEmptyState } from "@/components/ojt/ojt-empty-state";
import { OjtPlannerLegend } from "@/components/ojt/ojt-legend";
import { OjtFormApprovalPanel } from "@/components/ojt/ojt-form-approvals";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import type { OjtFormDocument, OjtPlan, OjtSettings } from "@/types/ojt";
import { cn } from "@/lib/utils";

export default function OjtPlannerPage() {
  const { profile } = useAuth();
  const { activeDepartments } = useDepartments();
  const defaultYear = currentCalendarYear();
  const [year, setYear] = useState(String(defaultYear));
  const [departmentId, setDepartmentId] = useState("");
  const [plans, setPlans] = useState<OjtPlan[]>([]);
  const [form, setForm] = useState<OjtFormDocument | null>(null);
  const [settings, setSettings] = useState<OjtSettings | null>(null);
  const [staff, setStaff] = useState<{ uid: string; displayName: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canWrite = profile?.role ? hasPermission(profile.role, "ojt:write") : false;
  const isSuperAdmin = profile?.role === "super_admin";
  const deptLocked = profile?.role === "department_head" ? profile.departmentId : undefined;
  const locked = Boolean(form?.locked);

  const trainerLabel = useCallback(
    (id?: string) => {
      if (!id) return "—";
      return staff.find((u) => u.uid === id)?.displayName || id;
    },
    [staff]
  );

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const dept = deptLocked || departmentId;
      setStaff(await listOjtStaffOptions());
      setSettings(await getOjtSettings());
      if (dept) {
        const [planRows, formRow] = await Promise.all([
          listOjtPlans({ year: Number(year), departmentId: dept }),
          getOjtFormDocument("planner", Number(year), dept),
        ]);
        setPlans(planRows);
        setForm(formRow);
      } else {
        setPlans(await listOjtPlans({ year: Number(year) }));
        setForm(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load planner");
    } finally {
      setLoading(false);
    }
  }, [departmentId, deptLocked, year]);

  useEffect(() => {
    if (deptLocked && !departmentId) setDepartmentId(deptLocked);
  }, [deptLocked, departmentId]);

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

  const handleSeed = async () => {
    if (!profile || !department) {
      toast.error("Select a department first");
      return;
    }
    setBusy(true);
    try {
      await seedPlannerFromTopics(Number(year), { id: department.id, name: department.name }, toOjtActor(profile));
      await ensureOjtFormDocument({
        kind: "planner",
        year: Number(year),
        departmentId: department.id,
        departmentName: department.name,
        actor: toOjtActor(profile),
      });
      toast.success("Planner rows loaded from active OJT topics");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to seed planner");
    } finally {
      setBusy(false);
    }
  };

  const patchPlan = async (plan: OjtPlan, patch: Partial<OjtPlan>) => {
    if (!profile || !canWrite) return;
    if (locked) {
      toast.error("Approved planner is controlled. Create a revision before changing months.");
      return;
    }
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, ...patch } : p)));
    try {
      await upsertOjtPlan(
        {
          ...plan,
          ...patch,
          year: plan.year,
          departmentId: plan.departmentId,
          topicId: plan.topicId,
        },
        toOjtActor(profile)
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      await refresh({ silent: true });
    }
  };

  const handlePrint = () => {
    if (!settings || !department) {
      toast.error("Select a department first");
      return;
    }
    printOjtPlannerForm({
      plans,
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
          <h1 className="text-2xl font-bold tracking-tight">Yearly OJT plan</h1>
          <p className="text-muted-foreground">
            Official planner: each topic has a Selection (S) row and an Execution (E) row. Tick the applicable months.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={!plans.length}>
          <Printer className="mr-2 h-4 w-4" />
          Print / PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Choose department & year</CardTitle>
          <CardDescription>
            Load topics first, then mark selection month and execution month on separate rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Year</Label>
            <Input
              type="number"
              className="w-28"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={2000}
              max={2100}
            />
          </div>
          <div className="space-y-1">
            <Label>Department</Label>
            <Select
              value={deptLocked || departmentId || undefined}
              onValueChange={setDepartmentId}
              disabled={Boolean(deptLocked)}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select department" />
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
          {canWrite && (
            <Button onClick={() => void handleSeed()} disabled={busy || !department || locked}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load topics into this year
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {department ? `${department.name} OJT planner` : "OJT planner"} · {year}
          </CardTitle>
          <CardDescription>
            Effective Date: {form?.effectiveDate || "—"} · Revision No.: {formatRevisionNumber(form?.revisionNumber || "00")}
            {settings ? ` · Format No.: ${form?.formNumber || settings.plannerFormNumber}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OjtPlannerLegend />
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading planner…
            </div>
          ) : plans.length === 0 ? (
            <OjtEmptyState
              title={department ? "No topics on this year yet" : "Select a department"}
              description={
                department
                  ? "Create training topics, then click Load topics into this year."
                  : "Pick a department above to see or build its yearly plan."
              }
              actionHref="/dashboard/ojt/topics"
              actionLabel="Go to topics"
            />
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 top-0 z-20 min-w-[56px] bg-background">S. No.</TableHead>
                    <TableHead className="sticky left-[56px] top-0 z-20 min-w-[220px] bg-background">Training Topic</TableHead>
                    <TableHead className="sticky top-0 z-10 min-w-[140px] bg-background">SOP No. / Reference</TableHead>
                    <TableHead className="sticky top-0 z-10 w-12 bg-background text-center">S/E</TableHead>
                    {CALENDAR_MONTHS.map((m) => (
                      <TableHead
                        key={m.number}
                        className={cn(
                          "sticky top-0 z-10 px-1 text-center text-xs bg-background",
                          m.number === currentCalendarMonth() && "text-primary"
                        )}
                      >
                        {m.short}
                      </TableHead>
                    ))}
                    <TableHead className="sticky top-0 z-10 bg-background">Trainer</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background">Responsible</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background">Status</TableHead>
                    {isSuperAdmin && <TableHead className="sticky top-0 z-10 bg-background text-right">Actions</TableHead>}
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
                          <div className="text-[11px] font-normal text-muted-foreground">
                            Planned S: {plan.selectionMonths.map((m) => CALENDAR_MONTHS[m - 1]?.short).join(", ") || "—"}
                            {" · "}
                            Planned E: {plan.executionMonths.map((m) => CALENDAR_MONTHS[m - 1]?.short).join(", ") || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs" rowSpan={2}>
                          {plan.referenceDocumentNumber || plan.sopNumber || "NA"}
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold text-sky-800 dark:text-sky-200">S</TableCell>
                        {CALENDAR_MONTHS.map((m) => {
                          const on = plan.selectionMonths.includes(m.number);
                          return (
                            <TableCell key={`s-${m.number}`} className="px-1 text-center">
                              <button
                                type="button"
                                disabled={!canWrite || locked}
                                onClick={() =>
                                  void patchPlan(plan, {
                                    selectionMonths: toggleMonthList(plan.selectionMonths, m.number),
                                  })
                                }
                                title="Toggle selection month"
                                className={cn(
                                  "h-8 w-9 rounded-md text-xs font-semibold",
                                  on
                                    ? "bg-sky-500/20 text-sky-800 dark:text-sky-200"
                                    : "bg-muted/40 text-muted-foreground hover:bg-muted",
                                  m.number === currentCalendarMonth() && "ring-1 ring-primary/50",
                                  (!canWrite || locked) && "cursor-default"
                                )}
                              >
                                {on ? "✓" : ""}
                              </button>
                            </TableCell>
                          );
                        })}
                        <TableCell rowSpan={2}>
                          <Select
                            disabled={!canWrite || locked}
                            value={plan.trainerId || "none"}
                            onValueChange={(v) => {
                              const uid = v === "none" ? undefined : v;
                              void patchPlan(plan, {
                                trainerId: uid,
                                trainerName: uid ? trainerLabel(uid) : undefined,
                              });
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Trainer" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {staff
                                .filter((u) =>
                                  u.role === "trainer" || u.role === "department_head" || u.role === "super_admin"
                                )
                                .map((u) => (
                                  <SelectItem key={u.uid} value={u.uid}>
                                    {u.displayName}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell rowSpan={2}>
                          <Select
                            disabled={!canWrite || locked}
                            value={plan.responsiblePersonId || "none"}
                            onValueChange={(v) => {
                              const uid = v === "none" ? undefined : v;
                              void patchPlan(plan, {
                                responsiblePersonId: uid,
                                responsiblePersonName: uid ? trainerLabel(uid) : undefined,
                              });
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Responsible" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {staff
                                .filter((u) =>
                                  ["department_head", "qa", "trainer", "hr"].includes(u.role)
                                )
                                .map((u) => (
                                  <SelectItem key={u.uid} value={u.uid}>
                                    {u.displayName}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell rowSpan={2}>
                          <StatusBadge status={plan.status} />
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell rowSpan={2}>
                            <div className="flex justify-end">
                              <AdminDeleteButton
                                confirmTitle={`Delete ${plan.trainingTopic} from ${plan.year}?`}
                                confirmDescription="This yearly plan row and any linked OJT records will be removed permanently. Only Super Admin can delete."
                                successMessage="Planner row deleted"
                                onDelete={async () => {
                                  if (!profile) throw new Error("Not signed in");
                                  await deleteOjtPlan(plan.id, toOjtActor(profile));
                                  await refresh({ silent: true });
                                }}
                              />
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-center text-xs font-semibold text-emerald-800 dark:text-emerald-200">E</TableCell>
                        {CALENDAR_MONTHS.map((m) => {
                          const on = plan.executionMonths.includes(m.number);
                          return (
                            <TableCell key={`e-${m.number}`} className="px-1 text-center">
                              <button
                                type="button"
                                disabled={!canWrite || locked}
                                onClick={() =>
                                  void patchPlan(plan, {
                                    executionMonths: toggleMonthList(plan.executionMonths, m.number),
                                  })
                                }
                                title="Toggle execution month"
                                className={cn(
                                  "h-8 w-9 rounded-md text-xs font-semibold",
                                  on
                                    ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                                    : "bg-muted/40 text-muted-foreground hover:bg-muted",
                                  m.number === currentCalendarMonth() && "ring-1 ring-primary/50",
                                  (!canWrite || locked) && "cursor-default"
                                )}
                              >
                                {on ? "✓" : ""}
                              </button>
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
          kind="planner"
          year={Number(year)}
          departmentId={department.id}
          departmentName={department.name}
          form={form}
          onChanged={() => refresh({ silent: true })}
        />
      )}
    </div>
  );
}
