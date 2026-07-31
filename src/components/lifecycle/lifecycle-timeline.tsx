"use client";

import { formatDateTime } from "@/lib/utils";
import { LIFECYCLE_STAGES, stageStatus } from "@/lib/lifecycle/stages";
import type { LifecycleEvent, LifecycleStage } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock } from "lucide-react";

interface LifecycleTimelineProps {
  currentStage: LifecycleStage;
  events: LifecycleEvent[];
  maxHeight?: string;
}

export function LifecycleTimeline({
  currentStage,
  events,
  maxHeight = "480px",
}: LifecycleTimelineProps) {
  const eventByStage = new Map<LifecycleStage, LifecycleEvent>();
  for (const e of events) {
    const existing = eventByStage.get(e.stage);
    if (!existing || (e.completedAt && !existing.completedAt) || e.status === "completed") {
      eventByStage.set(e.stage, e);
    }
  }

  return (
    <ScrollArea style={{ maxHeight }}>
      <div className="relative space-y-0 pl-6">
        <div className="absolute bottom-2 left-2 top-2 w-px bg-border" />
        {LIFECYCLE_STAGES.map((stage) => {
          const status = stageStatus(currentStage, stage.stage);
          const event = eventByStage.get(stage.stage);
          return (
            <div key={stage.stage} className="relative pb-5 last:pb-0">
              <div
                className={cn(
                  "absolute -left-[1.15rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background",
                  status === "completed" && "text-emerald-600",
                  status === "current" && "text-primary",
                  status === "upcoming" && "text-muted-foreground"
                )}
              >
                {status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : status === "current" ? (
                  <Clock className="h-5 w-5" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              <div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    status === "upcoming" && "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {event?.description || stage.description}
                </p>
                {(event?.completedAt || event?.actorName) && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {event.actorName && `${event.actorName} · `}
                    {event.completedAt ? formatDateTime(event.completedAt) : "In progress"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
