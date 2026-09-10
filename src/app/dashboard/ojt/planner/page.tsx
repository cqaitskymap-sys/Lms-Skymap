"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { useDepartments } from "@/hooks/use-departments";
import { listOjtPlans, listOjtStaffOptions, seedPlannerFromTopics, upsertOjtPlan } from "@/lib/services/ojt";
import { toOjtActor } from "@/lib/ojt/actor";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import { CALENDAR_MONTHS, currentCalendarMonth, currentCalendarYear, cyclePlannerMonth, plannerMark } from "@/lib/ojt/constants";
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
import { OjtPlannerLegend, PLANNER_MARK_CLASS } from "@/components/ojt/ojt-legend";
import type { OjtPlan } from "@/types/ojt";
import { cn } from "@/lib/utils";

export default function OjtPlannerPage() {
  const { profile } = useAuth();
  const { activeDepartments } = useDepartments();
  const defaultYear = currentCalendarYear();
  const [year, setYear] = useState(String(defaultYear));
  const [departmentId, setDepartmentId] = useState("");
  const [plans, setPlans] = useState<OjtPlan[]>([]);
  const [staff, setStaff] = useState<{ uid: string; displayName: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canWrite = profile?.role ? hasPermission(profile.role, "ojt:write") : false;
  const deptLocked = profile?.role === "department_head" ? profile.departmentId : undefined;

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
      if (dept) {
        setPlans(await listOjtPlans({ year: Number(year), departmentId: dept }));
      } else {
        setPlans(await listOjtPlans({ year: Number(year) }));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Yearly OJT plan</h1>
        <p className="text-muted-foreground">
          Click a month to cycle: blank → S (select people) → S/E → E (train) → blank.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Choose department & year</CardTitle>
          <CardDescription>
            Load topics first, then mark when people should be selected and when training happens.
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
            <Button onClick={() => void handleSeed()} disabled={busy || !department}>
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
            Current month is outlined. Training uses the SOP version that is approved when you assign a person.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Training Topic</TableHead>
                  <TableHead className="min-w-[140px]">SOP / Reference</TableHead>
                  {CALENDAR_MONTHS.map((m) => (
                    <TableHead
                      key={m.number}
                      className={cn(
                        "px-1 text-center text-xs",
                        m.number === currentCalendarMonth() && "text-primary"
                      )}
                    >
                      {m.short}
                    </TableHead>
                  ))}
                  <TableHead>Trainer</TableHead>
                  <TableHead>Responsible</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.trainingTopic}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {plan.referenceDocumentNumber || plan.sopNumber || "NA"}
                    </TableCell>
                    {CALENDAR_MONTHS.map((m) => {
                      const mark = plannerMark(plan.selectionMonths, plan.executionMonths, m.number);
                      return (
                        <TableCell key={m.number} className="px-1 text-center">
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => {
                              const next = cyclePlannerMonth(
                                plan.selectionMonths,
                                plan.executionMonths,
                                m.number
                              );
                              void patchPlan(plan, next);
                            }}
                            className={cn(
                              "h-8 w-9 rounded-md text-xs font-semibold",
                              mark
                                ? PLANNER_MARK_CLASS[mark]
                                : "bg-muted/40 text-muted-foreground hover:bg-muted",
                              m.number === currentCalendarMonth() && "ring-1 ring-primary/50",
                              !canWrite && "cursor-default"
                            )}
                            title="Click to cycle: S (select) → S/E → E (train) → blank"
                          >
                            {mark || "·"}
                          </button>
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Select
                        disabled={!canWrite}
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
                            .filter((u) => u.role === "trainer" || u.role === "department_head")
                            .map((u) => (
                              <SelectItem key={u.uid} value={u.uid}>
                                {u.displayName}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        disabled={!canWrite}
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
                    <TableCell>
                      <StatusBadge status={plan.status} />
                    </TableCell>
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
