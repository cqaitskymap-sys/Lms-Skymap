"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import type { OjtAssignment } from "@/types/ojt";
import { ojtNextAction, ojtStatusLabel, ojtWorkflowSteps } from "@/lib/ojt/next-action";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";

export function OjtProgress({ assignment }: { assignment: OjtAssignment }) {
  const steps = ojtWorkflowSteps(assignment);
  return (
    <ol className="flex flex-wrap gap-1.5">
      {steps.map((step, index) => (
        <li key={step.key} className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium",
              step.state === "done" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
              step.state === "current" && "bg-primary text-primary-foreground",
              step.state === "upcoming" && "bg-muted text-muted-foreground",
              step.state === "blocked" && "bg-red-500/15 text-red-700 dark:text-red-300"
            )}
          >
            {step.label}
          </span>
          {index < steps.length - 1 ? (
            <span className="text-muted-foreground/50" aria-hidden>
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

const toneClass = {
  default: "border-primary/30 bg-primary/5",
  warning: "border-amber-500/40 bg-amber-500/10",
  danger: "border-red-500/40 bg-red-500/10",
  success: "border-emerald-500/40 bg-emerald-500/10",
};

export function OjtNextStepBanner({
  assignment,
  role,
}: {
  assignment: OjtAssignment;
  role?: UserRole | null;
}) {
  const pathname = usePathname();
  const action = ojtNextAction(assignment, role);
  const target = action.formId ? `${pathname}#${action.formId}` : action.href;

  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4", toneClass[action.tone])}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{action.title}</p>
          <StatusBadge status={assignment.status} label={ojtStatusLabel(assignment.status)} />
        </div>
        <p className="text-sm text-muted-foreground">{action.hint}</p>
        <p className="text-xs text-muted-foreground">Who should act now: {action.waitingOn}</p>
      </div>
      {action.canAct ? (
        <Button size="sm" asChild>
          <Link href={target}>Continue</Link>
        </Button>
      ) : null}
    </div>
  );
}
