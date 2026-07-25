"use client";

import { Progress } from "@/components/ui/progress";
import { getStageDefinition } from "@/lib/lifecycle/stages";
import type { LifecycleStage } from "@/types";
import { cn } from "@/lib/utils";

interface LifecycleProgressBarProps {
  stage: LifecycleStage;
  progress?: number;
  className?: string;
  showLabel?: boolean;
}

export function LifecycleProgressBar({
  stage,
  progress,
  className,
  showLabel = true,
}: LifecycleProgressBarProps) {
  const def = getStageDefinition(stage);
  const value = progress ?? def.progress;

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{def.label}</span>
          <span className="tabular-nums text-muted-foreground">{value}%</span>
        </div>
      )}
      <Progress value={value} className="h-2.5" />
      <p className="text-xs text-muted-foreground">{def.description}</p>
    </div>
  );
}
