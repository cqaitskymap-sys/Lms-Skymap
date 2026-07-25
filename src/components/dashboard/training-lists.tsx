"use client";

import Link from "next/link";
import { ArrowRight, Clock, AlertTriangle } from "lucide-react";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { MotionItem } from "@/components/dashboard/motion";
import { StatusBadge } from "@/components/shared/status-badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { DashTrainingItem } from "@/lib/dashboard/data";

export function UpcomingTrainingList({ items }: { items: DashTrainingItem[] }) {
  return (
    <MotionItem className="h-full">
      <GlassCard className="h-full">
        <GlassCardHeader
          title="Upcoming training"
          description="Next scheduled sessions"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/training">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        />
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href || "/dashboard/training"}
              className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/30 p-3 transition-colors hover:bg-white/50 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div className="mt-0.5 rounded-md bg-primary/15 p-2 text-primary">
                <Clock className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatDateTime(item.date)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </GlassCard>
    </MotionItem>
  );
}

export function OverdueTrainingList({ items }: { items: DashTrainingItem[] }) {
  return (
    <MotionItem className="h-full">
      <GlassCard className="h-full">
        <GlassCardHeader
          title="Overdue training"
          description="Past due — escalate"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/training">
                Resolve <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        />
        <div className="space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No overdue trainings.</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 dark:bg-red-500/10"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                  <Progress value={item.progress ?? 0} className="mt-2 h-1.5" />
                  <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">
                    Due {formatDateTime(item.date)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </MotionItem>
  );
}
