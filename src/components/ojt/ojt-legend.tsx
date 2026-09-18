import { cn } from "@/lib/utils";

export function OjtPlannerLegend() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <LegendSwatch className="bg-sky-500/20 text-sky-800 dark:text-sky-200" label="S ✓" hint="Blue S = month you choose people" />
        <LegendSwatch className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-200" label="E ✓" hint="Green E = month you train them" />
        <LegendSwatch className="bg-muted/60 text-muted-foreground" label="" hint="Empty = not planned" />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Click a month to tick or untick it. First finish the S (people) month, then tick the E (training) month.
      </p>
    </div>
  );
}

export function OjtMatrixLegend() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <LegendSwatch className="bg-muted/40" label="blank" hint="Not chosen yet — click to assign" />
        <LegendSwatch className="bg-emerald-500/15 text-emerald-700" label="✓" hint="This person needs this training" />
        <LegendSwatch className="bg-muted text-muted-foreground" label="NA" hint="Not needed for this person" />
      </div>
      <p className="text-[11px] text-muted-foreground">
        S row = click under a name to mark ✓ or NA. E row later shows the training date. After ✓, open All records to book a date.
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
