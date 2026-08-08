"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { RequirePermission } from "@/components/auth/require-permission";
import { ReportFiltersBar } from "@/components/reports/report-filters";
import { ReportCharts } from "@/components/reports/report-charts";
import { ReportTable } from "@/components/reports/report-table";
import { ReportExportMenu } from "@/components/reports/report-export-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  buildReport,
  emptyFilters,
  loadReportSnapshot,
  type ReportSnapshot,
} from "@/lib/reports/build";
import {
  REPORT_CATALOG,
  type ReportDataset,
  type ReportFilters,
  type ReportType,
} from "@/lib/reports/types";
import { CERTIFICATES_UPDATED_EVENT } from "@/lib/certificates/demo-store";
import { ASSESSMENT_UPDATED_EVENT } from "@/lib/assessments/demo-store";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const TONE: Record<string, string> = {
  default: "text-foreground",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-destructive",
};

export default function ReportsPage() {
  const { profile, role } = useAuth();
  const deptScope =
    role === "department_head" ? profile?.departmentId || undefined : undefined;
  const canAudit = !!role && hasPermission(role, "audit:read");

  const catalog = useMemo(
    () =>
      REPORT_CATALOG.filter((r) => r.type !== "audit_report" || canAudit),
    [canAudit]
  );

  const [type, setType] = useState<ReportType>("employee_training");
  const [filters, setFilters] = useState<ReportFilters>(() =>
    emptyFilters(deptScope)
  );
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [dataset, setDataset] = useState<ReportDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deptScope) return;
    setFilters((prev) =>
      prev.departmentId === deptScope ? prev : { ...prev, departmentId: deptScope }
    );
  }, [deptScope]);

  useEffect(() => {
    if (type === "audit_report" && !canAudit) {
      setType("employee_training");
    }
  }, [type, canAudit]);

  const refreshSnapshot = useCallback(async () => {
    if (role === "department_head" && !deptScope) {
      setLoading(false);
      setError("Your account is not linked to a department.");
      setSnapshot(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await loadReportSnapshot({
        departmentId: deptScope,
        includeAudit: canAudit,
      });
      setSnapshot(next);
      if (next.warnings.length) {
        toast.message("Some report sources failed", {
          description: next.warnings.join(" · "),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report data");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [deptScope, canAudit, role]);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  useEffect(() => {
    const refresh = () => void refreshSnapshot();
    window.addEventListener(TRAINING_UPDATED_EVENT, refresh);
    window.addEventListener("pharma-lifecycle-updated", refresh);
    window.addEventListener("pharma-sops-updated", refresh);
    window.addEventListener(ASSESSMENT_UPDATED_EVENT, refresh);
    window.addEventListener(CERTIFICATES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(TRAINING_UPDATED_EVENT, refresh);
      window.removeEventListener("pharma-lifecycle-updated", refresh);
      window.removeEventListener("pharma-sops-updated", refresh);
      window.removeEventListener(ASSESSMENT_UPDATED_EVENT, refresh);
      window.removeEventListener(CERTIFICATES_UPDATED_EVENT, refresh);
    };
  }, [refreshSnapshot]);

  useEffect(() => {
    if (!snapshot) {
      setDataset(null);
      return;
    }
    let cancelled = false;
    void buildReport(type, filters, snapshot).then((d) => {
      if (!cancelled) setDataset(d);
    });
    return () => {
      cancelled = true;
    };
  }, [type, filters, snapshot]);

  const activeMeta = catalog.find((r) => r.type === type);

  return (
    <RequirePermission permission="reports:read">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Training, compliance, exams, certificates, matrix & audit — with Excel / CSV / PDF
              export
              {deptScope ? " · scoped to your department" : ""}
            </p>
          </div>
          {dataset ? <ReportExportMenu dataset={dataset} /> : null}
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <nav className="w-full shrink-0 space-y-1 lg:w-56">
            {catalog.map((r) => (
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
                {type === r.type && (
                  <span className="mt-0.5 block text-xs opacity-80">{r.description}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 space-y-4">
            <ReportFiltersBar
              filters={filters}
              onChange={setFilters}
              lockedDepartmentId={deptScope}
            />

            {activeMeta && !loading && !error && (
              <p className="text-sm text-muted-foreground">{activeMeta.description}</p>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading report data…
              </div>
            )}

            {error && !loading && (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={() => void refreshSnapshot()}>
                  Retry
                </Button>
              </div>
            )}

            {!loading && !error && dataset && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {dataset.kpis.map((k) => (
                    <Card key={k.label}>
                      <CardContent className="pt-5">
                        <p
                          className={cn(
                            "text-2xl font-bold tracking-tight",
                            TONE[k.tone || "default"]
                          )}
                        >
                          {k.value}
                        </p>
                        <p className="text-sm text-muted-foreground">{k.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <ReportCharts dataset={dataset} />
                <ReportTable dataset={dataset} />
              </>
            )}
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
