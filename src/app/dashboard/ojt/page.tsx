"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { useDepartments } from "@/hooks/use-departments";
import {
  buildOjtDashboardStats,
  listOjtAssignments,
  listOjtTopics,
  type OjtAssignmentFilters,
} from "@/lib/services/ojt";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import { currentCalendarMonth, currentCalendarYear, monthShort } from "@/lib/ojt/constants";
import { isOjtOverdue } from "@/lib/ojt/workflow";
import { actionableOjtQueue, ojtStatusLabel, waitingOjtQueue } from "@/lib/ojt/next-action";
import { GlassStatCard } from "@/components/dashboard/glass-stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { OjtGuide } from "@/components/ojt/ojt-guide";
import { OjtEmptyState } from "@/components/ojt/ojt-empty-state";
import type { OjtAssignment, OjtDashboardStats, OjtTopic } from "@/types/ojt";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function OjtDashboardPage() {
  const { profile } = useAuth();
  const { activeDepartments } = useDepartments();
  const [assignments, setAssignments] = useState<OjtAssignment[]>([]);
  const [topics, setTopics] = useState<OjtTopic[]>([]);
  const [stats, setStats] = useState<OjtDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo((): OjtAssignmentFilters | undefined => {
    if (!profile) return undefined;
    if (profile.role === "employee" && profile.employeeId) {
      return { employeeId: profile.employeeId };
    }
    if (profile.role === "trainer") return { trainerId: profile.uid };
    if (profile.role === "department_head" && profile.departmentId) {
      return { departmentId: profile.departmentId };
    }
    return undefined;
  }, [profile]);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      if (profile?.role === "employee" && !profile.employeeId) {
        setAssignments([]);
        setTopics([]);
        setStats(await buildOjtDashboardStats([], []));
        return;
      }
      const deptId =
        profile?.role === "department_head" ? profile.departmentId : undefined;
      const [asg, tops] = await Promise.all([
        listOjtAssignments(filters),
        listOjtTopics(deptId),
      ]);
      setAssignments(asg);
      setTopics(tops);
      setStats(await buildOjtDashboardStats(asg, tops));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load OJT dashboard");
    } finally {
      setLoading(false);
    }
  }, [filters, profile?.departmentId, profile?.employeeId, profile?.role]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh({ silent: true });
    window.addEventListener(OJT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(OJT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const monthly = useMemo(() => {
    const year = currentCalendarYear();
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const rows = assignments.filter(
        (a) => a.year === year && a.plannedExecutionMonth === month && a.status !== "cancelled"
      );
      return {
        month: monthShort(month),
        planned: rows.length,
        completed: rows.filter((a) => a.status === "completed").length,
        overdue: rows.filter((a) => isOjtOverdue(a)).length,
      };
    });
  }, [assignments]);

  const deptBars = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number }>();
    for (const a of assignments) {
      const key = a.departmentId;
      const name =
        a.departmentName ||
        activeDepartments.find((d) => d.id === a.departmentId)?.name ||
        key;
      const row = map.get(key) || { name, total: 0, completed: 0 };
      if (a.status !== "cancelled") row.total += 1;
      if (a.status === "completed") row.completed += 1;
      map.set(key, row);
    }
    return [...map.values()];
  }, [assignments, activeDepartments]);

  const canWrite = profile?.role ? hasPermission(profile.role, "ojt:write") : false;
  const myActions = useMemo(
    () => actionableOjtQueue(assignments, profile?.role),
    [assignments, profile?.role]
  );
  const waiting = useMemo(
    () => waitingOjtQueue(assignments, profile?.role, 4),
    [assignments, profile?.role]
  );
  const overdueRows = assignments.filter((a) => isOjtOverdue(a)).slice(0, 8);
  const isPersonal = profile?.role === "employee" || profile?.role === "trainer";

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading OJT dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Could not load OJT data</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  const s = stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">On Job Training</h1>
          <p className="text-muted-foreground">
            {profile?.role === "employee"
              ? "Your practical shop-floor training — acknowledge when the trainer has finished."
              : profile?.role === "trainer"
                ? "Sessions assigned to you: demonstrate, observe, then score competency."
                : "Plan months, select people, conduct practical training, then sign off."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {canWrite && (
            <Button size="sm" asChild>
              <Link href="/dashboard/ojt/planner">Open yearly plan</Link>
            </Button>
          )}
        </div>
      </div>

      <OjtGuide role={profile?.role} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlassStatCard title="OJT topics" value={s?.totalTopics ?? 0} icon={ClipboardList} />
        <GlassStatCard title="Assigned" value={s?.totalAssigned ?? 0} icon={CalendarCheck} />
        <GlassStatCard
          title="Completed"
          value={s?.completed ?? 0}
          description={`${s?.completionPercent ?? 0}% completion`}
          icon={CheckCircle2}
          tone="success"
        />
        <GlassStatCard
          title="Overdue"
          value={s?.overdue ?? 0}
          icon={AlertTriangle}
          tone={(s?.overdue ?? 0) > 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your next actions</CardTitle>
            <CardDescription>
              {myActions.length
                ? "These records are waiting on you."
                : "Nothing needs your action right now."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myActions.length === 0 ? (
              <OjtEmptyState
                title="You're all caught up"
                description={
                  canWrite
                    ? "Add topics, plan months, then select employees on the matrix to start OJT."
                    : "When someone assigns or schedules an OJT for you, it will appear here."
                }
                actionHref={canWrite ? "/dashboard/ojt/topics" : undefined}
                actionLabel={canWrite ? "Add a topic" : undefined}
              />
            ) : (
              <ul className="divide-y">
                {myActions.map(({ assignment, action }) => (
                  <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium">{assignment.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {assignment.trainingTopic} · {action.title}
                      </p>
                    </div>
                    <Button size="sm" asChild>
                      <Link href={action.href}>Continue</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isPersonal ? "Waiting on others" : "Pipeline snapshot"}</CardTitle>
            <CardDescription>
              {isPersonal
                ? "OJT that is in progress but not yours to action."
                : "Counts by stage this year"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPersonal ? (
              waiting.length === 0 ? (
                <p className="text-sm text-muted-foreground">No other open OJT records.</p>
              ) : (
                <ul className="divide-y">
                  {waiting.map(({ assignment, action }) => (
                    <li key={assignment.id} className="flex items-center justify-between gap-2 py-2">
                      <div>
                        <p className="text-sm font-medium">{assignment.trainingTopic}</p>
                        <p className="text-xs text-muted-foreground">{action.hint}</p>
                      </div>
                      <StatusBadge
                        status={assignment.status}
                        label={ojtStatusLabel(assignment.status)}
                      />
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["This month", s?.thisMonth],
                  ["Scheduled", s?.scheduled],
                  ["In progress", s?.inProgress],
                  ["Pending", s?.pending],
                  ["Failed", s?.failed],
                  ["Retraining", s?.retrainingRequired],
                  ["Planned / selected", s?.planned],
                  ["Cancelled", s?.cancelled],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-semibold">{value ?? 0}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!isPersonal ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly OJT trend</CardTitle>
              <CardDescription>
                Planned vs completed for {currentCalendarYear()} · current month{" "}
                {monthShort(currentCalendarMonth())}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="planned" name="Planned" fill="hsl(199, 89%, 40%)" radius={4} />
                  <Bar dataKey="completed" name="Completed" fill="hsl(160, 84%, 39%)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Department-wise OJT</CardTitle>
              <CardDescription>Assigned vs completed</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              {deptBars.length === 0 ? (
                <p className="text-sm text-muted-foreground">No department OJT data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptBars} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" name="Assigned" fill="hsl(199, 89%, 40%)" radius={4} />
                    <Bar dataKey="completed" name="Completed" fill="hsl(160, 84%, 39%)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Overdue OJT</CardTitle>
          <CardDescription>Planned execution month has passed and the record is still open</CardDescription>
        </CardHeader>
        <CardContent>
          {overdueRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overdue OJT records.</p>
          ) : (
            <ul className="divide-y">
              {overdueRows.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{a.employeeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.trainingTopic} · {a.sopNumber || a.referenceDocumentNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status="overdue" />
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/ojt/assignments/${a.id}`}>Open</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
