import { cn } from "@/lib/utils";

export function OjtPlannerLegend() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <LegendSwatch className="bg-sky-500/20 text-sky-800 dark:text-sky-200" label="S ✓" hint="Selection month (official row)" />
        <LegendSwatch className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-200" label="E ✓" hint="Execution month (official row)" />
        <LegendSwatch className="bg-muted/60 text-muted-foreground" label="" hint="Not planned" />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Official form uses separate S and E rows with tick marks. Combined S/E is not stored as a single value.
      </p>
    </div>
  );
}

export function OjtMatrixLegend() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <LegendSwatch className="bg-muted/40" label="blank" hint="No selection" />
        <LegendSwatch className="bg-emerald-500/15 text-emerald-700" label="✓" hint="Selected for this topic" />
        <LegendSwatch className="bg-muted text-muted-foreground" label="NA" hint="Not applicable — no OJT record" />
      </div>
      <p className="text-[11px] text-muted-foreground">
        S = Selection of Employee. E = Execution date of training. Workflow states (scheduled, overdue) are system
        enhancements shown as tooltips, not official matrix values. Training shall be imparted on current version of SOP.
      </p>
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
        {label || "·"}
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
