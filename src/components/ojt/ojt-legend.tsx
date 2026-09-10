import { cn } from "@/lib/utils";

export function OjtPlannerLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <LegendSwatch className="bg-sky-500/20 text-sky-800 dark:text-sky-200" label="S" hint="Select people this month" />
      <LegendSwatch className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-200" label="E" hint="Train this month" />
      <LegendSwatch className="bg-violet-500/20 text-violet-800 dark:text-violet-200" label="S/E" hint="Select and train same month" />
      <LegendSwatch className="bg-muted/60 text-muted-foreground" label="·" hint="Not planned" />
    </div>
  );
}

export function OjtMatrixLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <LegendSwatch className="bg-muted/40" label="—" hint="Click to select" />
      <LegendSwatch className="bg-emerald-500/15 text-emerald-700" label="✓" hint="Needs this OJT" />
      <LegendSwatch className="bg-muted text-muted-foreground" label="NA" hint="Not applicable" />
      <LegendSwatch className="bg-indigo-500/15 text-indigo-700" label="Scheduled" hint="Date booked" />
      <LegendSwatch className="bg-blue-500/15 text-blue-700" label="In progress" hint="Training underway" />
      <LegendSwatch className="bg-emerald-600/15 text-emerald-800" label="Completed" hint="Signed off" />
      <LegendSwatch className="bg-red-500/15 text-red-700" label="Overdue / Failed" hint="Needs attention" />
    </div>
  );
}

function LegendSwatch({
  className,
  label,
  hint,
}: {
  className: string;
  label: string;
  hint: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-flex h-6 min-w-8 items-center justify-center rounded-md px-1.5 font-semibold", className)}>
        {label}
      </span>
      {hint}
    </span>
  );
}

export const PLANNER_MARK_CLASS: Record<string, string> = {
  S: "bg-sky-500/20 text-sky-800 dark:text-sky-200",
  E: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200",
  "S/E": "bg-violet-500/20 text-violet-800 dark:text-violet-200",
};

export const MATRIX_CELL_CLASS: Record<string, string> = {
  not_set: "bg-muted/40 text-muted-foreground hover:bg-muted",
  not_applicable: "bg-muted text-muted-foreground",
  selected: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  pending: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  scheduled: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  completed: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200",
  failed: "bg-red-500/15 text-red-700 dark:text-red-300",
  retraining_required: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
  overdue: "bg-red-500/20 text-red-800 dark:text-red-200",
  cancelled: "bg-slate-200/60 text-slate-500",
};
