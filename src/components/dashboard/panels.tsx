"use client";

import Link from "next/link";
import { Bell, CheckCircle2, Circle } from "lucide-react";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { MotionItem } from "@/components/dashboard/motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashNotification, DashTask, DashQuickAction, DashActivity, DashAlert } from "@/lib/dashboard/data";
import { ActivityTimeline } from "@/components/shared/activity-timeline";

export function NotificationsPanel({ items }: { items: DashNotification[] }) {
  return (
    <MotionItem className="h-full">
      <GlassCard className="h-full">
        <GlassCardHeader
          title="Notifications"
          description="Latest updates"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/notifications">All</Link>
            </Button>
          }
        />
        <div className="space-y-2">
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.href || "/dashboard/notifications"}
              className={cn(
                "block rounded-lg border px-3 py-2.5 transition-colors hover:bg-white/40 dark:hover:bg-white/5",
                n.unread
                  ? "border-primary/30 bg-primary/5"
                  : "border-transparent bg-white/20 dark:bg-white/5"
              )}
            >
              <div className="flex items-start gap-2">
                <Bell className={cn("mt-0.5 h-3.5 w-3.5", n.unread ? "text-primary" : "text-muted-foreground")} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{n.time}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </GlassCard>
    </MotionItem>
  );
}

export function QuickActions({ actions }: { actions: DashQuickAction[] }) {
  return (
    <MotionItem>
      <GlassCard>
        <GlassCardHeader title="Quick actions" description="Jump to common workflows" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {actions.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="group flex flex-col items-center gap-2 rounded-xl border border-white/20 bg-white/25 px-3 py-4 text-center transition-all hover:-translate-y-0.5 hover:bg-white/50 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div className="rounded-lg bg-primary/15 p-2.5 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <a.icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </GlassCard>
    </MotionItem>
  );
}

export function TodaysTasks({ tasks }: { tasks: DashTask[] }) {
  const priorityColor = {
    high: "text-red-600 dark:text-red-400",
    medium: "text-amber-600 dark:text-amber-400",
    low: "text-muted-foreground",
  };

  return (
    <MotionItem className="h-full">
      <GlassCard className="h-full">
        <GlassCardHeader title="Today's tasks" description="Prioritized for your role" />
        <div className="space-y-2">
          {tasks.map((t) => (
            <Link
              key={t.id}
              href={t.href || "#"}
              className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-white/40 dark:hover:bg-white/5"
            >
              {t.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{t.title}</p>
                <p className={cn("text-[11px]", priorityColor[t.priority])}>
                  {t.priority.toUpperCase()} · {t.due}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </GlassCard>
    </MotionItem>
  );
}

export function RecentActivities({ items }: { items: DashActivity[] }) {
  return (
    <MotionItem className="h-full">
      <GlassCard className="h-full">
        <GlassCardHeader title="Recent activities" description="Live operational trail" />
        <ActivityTimeline
          items={items.map((a) => ({
            id: a.id,
            timestamp: a.timestamp,
            description: a.description,
            actorEmail: a.actor,
            action: a.action as never,
          }))}
          maxHeight="280px"
        />
      </GlassCard>
    </MotionItem>
  );
}

export function AlertsPanel({
  title,
  description,
  alerts,
}: {
  title: string;
  description?: string;
  alerts: DashAlert[];
}) {
  const severity = {
    critical: "border-red-500/30 bg-red-500/10",
    warning: "border-amber-500/30 bg-amber-500/10",
    info: "border-sky-500/30 bg-sky-500/10",
  };

  return (
    <MotionItem className="h-full">
      <GlassCard className="h-full">
        <GlassCardHeader title={title} description={description} />
        <div className="space-y-2">
          {alerts.map((a) => (
            <Link
              key={a.id}
              href={a.href || "#"}
              className={cn("block rounded-lg border px-3 py-2.5", severity[a.severity])}
            >
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.message}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{a.time}</p>
            </Link>
          ))}
        </div>
      </GlassCard>
    </MotionItem>
  );
}
