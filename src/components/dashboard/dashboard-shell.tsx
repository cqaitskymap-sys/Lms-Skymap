"use client";

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
import {
  AUDIT_ALERTS,
  DASH_ACTIVITIES,
  DASH_NOTIFICATIONS,
  OVERDUE_TRAININGS,
  SOP_REVISION_ALERTS,
  TODAY_TASKS,
  UPCOMING_TRAININGS,
  roleQuickActions,
  roleStats,
} from "@/lib/dashboard/data";
import type { UserRole } from "@/types";

interface DashboardShellProps {
  role: UserRole | "super_admin";
  title: string;
  subtitle: string;
  /** Optional role-specific middle band */
  children?: React.ReactNode;
}

export function DashboardShell({ role, title, subtitle, children }: DashboardShellProps) {
  const stats = roleStats(role);
  const actions = roleQuickActions(role);

  return (
    <MotionSection className="space-y-5 md:space-y-6">
      <MotionItem>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          <p className="text-sm text-muted-foreground md:text-base">{subtitle}</p>
        </div>
      </MotionItem>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <GlassStatCard key={s.title} {...s} />
        ))}
      </div>

      <QuickActions actions={actions} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ComplianceTrendChart />
        </div>
        <ComplianceRing />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrainingProgressChart />
        {role === "qa" || role === "super_admin" || role === "department_head" ? (
          <DepartmentComplianceChart />
        ) : (
          <StatusDonutChart />
        )}
      </div>

      {children}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UpcomingTrainingList items={UPCOMING_TRAININGS} />
        <OverdueTrainingList items={OVERDUE_TRAININGS} />
        <TodaysTasks tasks={TODAY_TASKS} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniCalendar />
        <NotificationsPanel items={DASH_NOTIFICATIONS} />
        <AlertsPanel
          title="Audit alerts"
          description="Security & compliance signals"
          alerts={AUDIT_ALERTS}
        />
        <AlertsPanel
          title="SOP revision alerts"
          description="Version control & retraining"
          alerts={SOP_REVISION_ALERTS}
        />
      </div>

      <RecentActivities items={DASH_ACTIVITIES} />
    </MotionSection>
  );
}
