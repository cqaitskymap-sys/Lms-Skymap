"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { OjtPageHint } from "@/components/ojt/ojt-page-hint";
import { OjtFormApprovalPanel } from "@/components/ojt/ojt-form-approvals";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import type { OjtFormDocument, OjtPlan, OjtSettings } from "@/types/ojt";
import { cn } from "@/lib/utils";

export default function OjtPlannerPage() {
  const { profile } = useAuth();
  const { activeDepartments } = useDepartments();
  const searchParams = useSearchParams();
  const defaultYear = currentCalendarYear();
  const [year, setYear] = useState(() => searchParams.get("year") || String(defaultYear));
  const [departmentId, setDepartmentId] = useState(() => searchParams.get("departmentId") || "");
  const [plans, setPlans] = useState<OjtPlan[]>([]);
  const [form, setForm] = useState<OjtFormDocument | null>(null);
  const [settings, setSettings] = useState<OjtSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const plansRef = useRef<OjtPlan[]>([]);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const dirtyRef = useRef(false);

  const canWrite = profile?.role ? hasPermission(profile.role, "ojt:write") : false;
  const isSuperAdmin = profile?.role === "super_admin";
  const deptLocked = profile?.role === "department_head" ? profile.departmentId : undefined;
  const locked = Boolean(form?.locked);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent && dirtyRef.current) return;
    if (!opts?.silent) setLoading(true);
    try {
      const dept = deptLocked || departmentId;
      setSettings(await getOjtSettings());
      if (dept) {
        const [planRows, formRow] = await Promise.all([
          listOjtPlans({ year: Number(year), departmentId: dept }),
          getOjtFormDocument("planner", Number(year), dept),
        ]);
        if (opts?.silent && dirtyRef.current) return;
        plansRef.current = planRows;
        setPlans(planRows);
        setForm(formRow);
      } else {
        const planRows = await listOjtPlans({ year: Number(year) });
        if (opts?.silent && dirtyRef.current) return;
        plansRef.current = planRows;
        setPlans(planRows);
        setForm(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load planner");
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

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  const patchPlan = (plan: OjtPlan, patch: Partial<OjtPlan>) => {
    if (!profile || !canWrite) return;
    if (locked) {
      toast.error("Approved planner is controlled. Create a revision before changing months.");
      return;
    }
    const current = plansRef.current.find((p) => p.id === plan.id) ?? plan;
    const next = { ...current, ...patch };
    plansRef.current = plansRef.current.map((p) => (p.id === plan.id ? next : p));
    setPlans(plansRef.current);
    dirtyRef.current = true;
    const pending = saveTimers.current.get(plan.id);
    if (pending) clearTimeout(pending);
    saveTimers.current.set(
      plan.id,
      setTimeout(() => {
        saveTimers.current.delete(plan.id);
        void upsertOjtPlan(
          {
            ...next,
            year: next.year,
            departmentId: next.departmentId,
            topicId: next.topicId,
          },
          toOjtActor(profile)
        )
          .catch(async (err) => {
            toast.error(err instanceof Error ? err.message : "Save failed");
            dirtyRef.current = saveTimers.current.size > 0;
            await refresh({ silent: true });
          })
          .finally(() => {
            dirtyRef.current = saveTimers.current.size > 0;
          });
      }, 500)
    );
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
          <h1 className="text-2xl font-bold tracking-tight">Step 2 — Plan months</h1>
          <p className="text-muted-foreground">
            For each topic, tick when you will choose people (S) and when you will train them (E).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={!plans.length}>
          <Printer className="mr-2 h-4 w-4" />
          Print / PDF
        </Button>
      </div>
      <OjtPageHint title="How to fill this table">
        Choose department and year, then click <strong>Load topics into this year</strong>. Each topic has two rows:
        blue <strong>S</strong> = month you pick people, green <strong>E</strong> = month you train. Click a month to tick it.
      </OjtPageHint>

      <Card>
        <CardHeader>
            <CardTitle>Choose department & year</CardTitle>
            <CardDescription>
              Load topics first. Then tick months on the S row and the E row.
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
            <>
              <Button onClick={() => void handleSeed()} disabled={busy || !department || locked}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load topics into this year
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/dashboard/ojt/matrix">Next: select people →</Link>
              </Button>
            </>
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
                  ? "Go to Topics first, then click Load topics into this year."
                  : "Pick a department above to build its year plan."
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
                    <TableHead className="sticky top-0 z-10 w-16 bg-background text-center">Row</TableHead>
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
                                title="Tick this month to choose people"
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
                                title="Tick this month to train"
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
