"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { MotionItem, MotionSection } from "@/components/dashboard/motion";
import { GlassStatCard } from "@/components/dashboard/glass-stat-card";
import {
  ComplianceRing,
  ComplianceTrendChart,
  DepartmentComplianceChart,
  StatusDonutChart,
  TrainingProgressChart,
} from "@/components/dashboard/charts";
import { OverdueTrainingList, UpcomingTrainingList } from "@/components/dashboard/training-lists";
import {
  AlertsPanel,
  NotificationsPanel,
  QuickActions,
  RecentActivities,
  TodaysTasks,
} from "@/components/dashboard/panels";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { roleQuickActions } from "@/lib/dashboard/data";
import {
  buildDashboardView,
  emptyDashboardSnapshot,
  fetchDashboardSnapshot,
} from "@/lib/dashboard/live";
import type { UserRole } from "@/types";

export type DashboardView = ReturnType<typeof buildDashboardView>;

interface DashboardShellProps {
  role: UserRole | "super_admin";
  title: string;
  subtitle: string;
  children?:
    | React.ReactNode
    | ((ctx: { view: DashboardView; loading: boolean }) => React.ReactNode);
}

export function DashboardShell({ role, title, subtitle, children }: DashboardShellProps) {
  const { profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() =>
    buildDashboardView(emptyDashboardSnapshot(), role)
  );

  // Prefer signed-in profile role for Firestore scoping (prop may be wrong during redirects).
  const dataRole = profile?.role;

  const refresh = useCallback(async () => {
    if (authLoading || !profile?.role) return;
    setLoading(true);
    try {
      const snap = await fetchDashboardSnapshot({
        userId: profile.uid,
        role: dataRole,
        employeeId: profile.employeeId,
      });
      setView(buildDashboardView(snap, role));
    } finally {
      setLoading(false);
    }
  }, [authLoading, profile, dataRole, role]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    window.addEventListener("pharma-training-updated", onUpdate);
    window.addEventListener("pharma-sops-updated", onUpdate);
    window.addEventListener("pharma-assessments-updated", onUpdate);
    return () => {
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
      window.removeEventListener("pharma-training-updated", onUpdate);
      window.removeEventListener("pharma-sops-updated", onUpdate);
      window.removeEventListener("pharma-assessments-updated", onUpdate);
    };
  }, [refresh]);

  const actions = roleQuickActions(role);
  const slot =
    typeof children === "function" ? children({ view, loading }) : children;

  return (
    <MotionSection className="space-y-5 md:space-y-6">
      <MotionItem>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
            {loading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground md:text-base">{subtitle}</p>
        </div>
      </MotionItem>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {view.roleStats.map((s) => (
          <GlassStatCard key={s.title} {...s} />
        ))}
      </div>

      <QuickActions actions={actions} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ComplianceTrendChart data={view.complianceTrend} />
        </div>
        <ComplianceRing value={view.compliance} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrainingProgressChart data={view.trainingProgress} />
        {role === "qa" || role === "super_admin" || role === "department_head" ? (
          <DepartmentComplianceChart data={view.deptCompliance} />
        ) : (
          <StatusDonutChart data={view.statusDistribution} />
        )}
      </div>

      {slot}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UpcomingTrainingList items={view.upcoming} />
        <OverdueTrainingList items={view.overdueItems} />
        <TodaysTasks tasks={view.tasks} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniCalendar />
        <NotificationsPanel items={view.notifications} />
        <AlertsPanel
          title="Audit alerts"
          description="Security & compliance signals"
          alerts={view.auditAlerts}
        />
        <AlertsPanel
          title="SOP revision alerts"
          description="Version control & retraining"
          alerts={view.sopAlerts}
        />
      </div>

      <RecentActivities items={view.activities} />
    </MotionSection>
  );
}
