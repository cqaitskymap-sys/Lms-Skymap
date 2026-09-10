"use client";

import { CheckCircle2, Clock, ScrollText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatReadingClock } from "@/lib/sops/reading";
import { cn } from "@/lib/utils";

export function SopReadingBanner({
  remainingSeconds,
  requiredSeconds,
  elapsedSeconds,
  pagesSeen,
  pageCount,
  allPagesViewed,
  timerComplete,
  readingComplete,
  hasPdf,
}: {
  remainingSeconds: number;
  requiredSeconds: number;
  elapsedSeconds: number;
  pagesSeen: number[];
  pageCount: number;
  allPagesViewed: boolean;
  timerComplete: boolean;
  readingComplete: boolean;
  hasPdf: boolean;
}) {
  const timePct =
    requiredSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / requiredSeconds) * 100)) : 0;
  const pagePct =
    pageCount > 0 ? Math.min(100, Math.round((pagesSeen.length / pageCount) * 100)) : allPagesViewed ? 100 : 0;

  if (readingComplete) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-medium">Reading complete</p>
            <p className="text-xs text-muted-foreground">
              You can now sign the acknowledgement and take the exam.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <p className="text-sm font-medium">Read this SOP before acknowledging</p>
      <p className="text-xs text-muted-foreground">
        Stay on this page until the timer finishes
        {hasPdf ? ", and scroll every page to the end." : "."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="h-3.5 w-3.5" />
              Time remaining
            </span>
            <span className={cn("font-mono", timerComplete && "text-emerald-600")}>
              {timerComplete ? "Done" : formatReadingClock(remainingSeconds)}
            </span>
          </div>
          <Progress value={timePct} className="h-2" />
        </div>
        {hasPdf && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-medium">
                <ScrollText className="h-3.5 w-3.5" />
                Pages scrolled
              </span>
              <span className={cn("font-mono", allPagesViewed && "text-emerald-600")}>
                {allPagesViewed
                  ? "All pages"
                  : `${pagesSeen.length}/${pageCount || "…"}`}
              </span>
            </div>
            <Progress value={pagePct} className="h-2" />
          </div>
        )}
      </div>
    </div>
  );
}
