"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/dashboard/glass-card";
import { MotionItem } from "@/components/dashboard/motion";

interface GlassStatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const toneStyles = {
  default: "bg-primary/15 text-primary",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export function GlassStatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  tone = "default",
  className,
}: GlassStatCardProps) {
  return (
    <MotionItem>
      <GlassCard hover className={cn("h-full", className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="truncate text-2xl font-bold tracking-tight md:text-3xl">{value}</p>
            {(description || trend) && (
              <p className="text-xs text-muted-foreground">
                {trend && (
                  <span
                    className={cn(
                      "font-medium",
                      trend.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"
                    )}
                  >
                    {trend.value >= 0 ? "+" : ""}
                    {trend.value}%{" "}
                  </span>
                )}
                {trend?.label || description}
              </p>
            )}
          </div>
          <div className={cn("rounded-lg p-2.5", toneStyles[tone])}>
            <Icon className="h-4 w-4 md:h-5 md:w-5" />
          </div>
        </div>
      </GlassCard>
    </MotionItem>
  );
}
