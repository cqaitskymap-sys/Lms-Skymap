"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { RequirePermission } from "@/components/auth/require-permission";
import { ReportFiltersBar } from "@/components/reports/report-filters";
import { ReportCharts } from "@/components/reports/report-charts";
import { ReportTable } from "@/components/reports/report-table";
import { ReportExportMenu } from "@/components/reports/report-export-menu";
import { Card, CardContent } from "@/components/ui/card";
import { buildReport, emptyFilters } from "@/lib/reports/build";
import { REPORT_CATALOG, type ReportFilters, type ReportType } from "@/lib/reports/types";

const TONE: Record<string, string> = {
  default: "text-foreground",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-destructive",
};

export default function ReportsPage() {
  const [type, setType] = useState<ReportType>("employee_training");
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters);

  const dataset = useMemo(() => buildReport(type, filters), [type, filters]);

  return (
    <RequirePermission permission="reports:read">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Training, compliance, exams, certificates, matrix & audit — with Excel / CSV / PDF
              export
            </p>
          </div>
          <ReportExportMenu dataset={dataset} />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <nav className="w-full shrink-0 space-y-1 lg:w-56">
            {REPORT_CATALOG.map((r) => (
              <button
                key={r.type}
                type="button"
                onClick={() => setType(r.type)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  type === r.type
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="font-medium">{r.title}</span>
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 space-y-4">
            <ReportFiltersBar filters={filters} onChange={setFilters} />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {dataset.kpis.map((k) => (
                <Card key={k.label}>
                  <CardContent className="pt-5">
                    <p className={cn("text-2xl font-bold tracking-tight", TONE[k.tone || "default"])}>
                      {k.value}
                    </p>
                    <p className="text-sm text-muted-foreground">{k.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <ReportCharts dataset={dataset} />
            <ReportTable dataset={dataset} />
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
