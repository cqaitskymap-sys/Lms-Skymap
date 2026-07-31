"use client";

import { Check, Circle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LIFECYCLE_STAGES, stageStatus } from "@/lib/lifecycle/stages";
import type { LifecycleStage } from "@/types";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface LifecycleStatusTrackerProps {
  currentStage: LifecycleStage;
  className?: string;
}

export function LifecycleStatusTracker({ currentStage, className }: LifecycleStatusTrackerProps) {
  return (
    <ScrollArea className={cn("w-full whitespace-nowrap", className)}>
      <div className="flex min-w-max gap-0 pb-3">
        {LIFECYCLE_STAGES.map((stage, index) => {
          const status = stageStatus(currentStage, stage.stage);
          return (
            <div key={stage.stage} className="flex items-center">
              <div className="flex w-28 flex-col items-center gap-1.5 px-1">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    status === "completed" && "border-emerald-600 bg-emerald-600 text-white",
                    status === "current" && "border-primary bg-primary text-primary-foreground",
                    status === "upcoming" && "border-muted-foreground/30 bg-background text-muted-foreground"
                  )}
                >
                  {status === "completed" ? (
                    <Check className="h-4 w-4" />
                  ) : status === "current" ? (
                    <Circle className="h-3 w-3 fill-current" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                </div>
                <p
                  className={cn(
                    "text-center text-[10px] leading-tight",
                    status === "current" && "font-semibold text-foreground",
                    status === "completed" && "text-muted-foreground",
                    status === "upcoming" && "text-muted-foreground/70"
                  )}
                >
                  {stage.label}
                </p>
              </div>
              {index < LIFECYCLE_STAGES.length - 1 && (
                <div
                  className={cn(
                    "mb-5 h-0.5 w-4 shrink-0",
                    getStageCompleted(currentStage, stage.stage)
                      ? "bg-emerald-600"
                      : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function getStageCompleted(current: LifecycleStage, stage: LifecycleStage) {
  return stageStatus(current, stage) === "completed";
}
