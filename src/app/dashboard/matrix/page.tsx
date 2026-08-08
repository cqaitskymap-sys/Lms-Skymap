"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/auth-context";
import { listEmployeesForLifecycle } from "@/lib/services/lifecycle";
import { listSopsDetailed } from "@/lib/services/sops";
import {
  listTrainingAssignments,
  type TrainingAssignmentFilters,
} from "@/lib/services/training";
import {
  latestAssignmentsByCell,
  matrixCellLabel,
  matrixCellStatus,
  matrixExportColumnKey,
  resolveLatestAssignment,
  scopeMatrixEmployees,
  filterMatrixSops,
} from "@/lib/training/matrix";
import { ASSESSMENT_UPDATED_EVENT } from "@/lib/assessments/demo-store";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Employee, SopDocument, TrainingAssignment } from "@/types";

export default function MatrixPage() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sops, setSops] = useState<SopDocument[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const deptScope =
    profile?.role === "department_head" ? profile.departmentId : undefined;

  const assignmentFilters = useMemo((): TrainingAssignmentFilters | undefined => {
    if (profile?.role === "employee" && profile.employeeId) {
      return { employeeId: profile.employeeId };
    }
    if (deptScope) return { departmentId: deptScope };
    return undefined;
  }, [deptScope, profile?.role, profile?.employeeId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const employeesPromise =
        profile?.role === "employee"
          ? profile.employeeId
            ? listEmployeesForLifecycle({ employeeId: profile.employeeId })
            : Promise.resolve([] as Employee[])
          : listEmployeesForLifecycle().catch(() => [] as Employee[]);

      const [emps, sopList, asg] = await Promise.all([
        employeesPromise,
        listSopsDetailed({ status: "approved" }).catch(() => [] as SopDocument[]),
        listTrainingAssignments(assignmentFilters).catch(() => [] as TrainingAssignment[]),
      ]);
      setEmployees(emps);
      setSops(sopList);
      setAssignments(asg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load training matrix");
    } finally {
      setLoading(false);
    }
  }, [assignmentFilters, profile?.role, profile?.employeeId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    window.addEventListener("pharma-sops-updated", onUpdate);
    window.addEventListener(ASSESSMENT_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
      window.removeEventListener("pharma-sops-updated", onUpdate);
      window.removeEventListener(ASSESSMENT_UPDATED_EVENT, onUpdate);
    };
  }, [refresh]);

  const matrixEmployees = useMemo(
    () => scopeMatrixEmployees(employees, deptScope),
    [employees, deptScope]
  );

  const matrixSops = useMemo(
    () => filterMatrixSops(sops, deptScope),
    [sops, deptScope]
  );

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return matrixEmployees;
    return matrixEmployees.filter((e) =>
      `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(q)
    );
  }, [matrixEmployees, search]);

  const latestCells = useMemo(
    () => latestAssignmentsByCell(assignments),
    [assignments]
  );

  const passedCells = useMemo(
    () => latestCells.filter((a) => a.status === "passed").length,
    [latestCells]
  );

  const exportMatrix = () => {
    if (!visibleEmployees.length || !matrixSops.length) {
      toast.error("No employees or SOPs to export yet");
      return;
    }
    const rows = visibleEmployees.map((e) => {
      const row: Record<string, string> = {
        Employee: `${e.firstName} ${e.lastName}`,
        Code: e.employeeCode,
      };
      for (const s of matrixSops) {
        const a = resolveLatestAssignment(assignments, e.id, s.id);
        const col = matrixExportColumnKey(s, matrixSops);
        row[col] = matrixCellLabel(matrixCellStatus(a, s));
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Training Matrix");
    XLSX.writeFile(wb, "training-matrix.xlsx");
    toast.success("Matrix exported");
  };

  const emptyMessage = () => {
    if (!matrixEmployees.length && !matrixSops.length) {
      return (
        <>
          No matrix data yet.{" "}
          <Link href="/dashboard/employees" className="text-primary underline">
            Add employees
          </Link>{" "}
          and{" "}
          <Link href="/dashboard/sops" className="text-primary underline">
            approve SOPs
          </Link>
          , then assign training.
        </>
      );
    }
    if (!matrixEmployees.length) {
      return deptScope
        ? "No active employees in your department yet."
        : "No active employees in the matrix. Onboard and hand over employees first.";
    }
    if (!matrixSops.length) {
      return deptScope
        ? "No approved SOPs mapped to your department yet."
        : "No approved SOPs yet. Publish and approve SOPs to populate columns.";
    }
    return null;
  };

  const empty = emptyMessage();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Matrix</h1>
          <p className="text-muted-foreground">
            Employee × SOP compliance grid
            {deptScope ? " · department scoped" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportMatrix}>
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance matrix</CardTitle>
          <CardDescription>
            {matrixEmployees.length} employees · {matrixSops.length} SOPs · {passedCells} passed
            cells · {latestCells.length} active cells
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && !empty && (
            <Input
              placeholder="Search employees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading matrix…
            </div>
          ) : error ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                Retry
              </Button>
            </div>
          ) : empty ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
          ) : visibleEmployees.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No employees match your search.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">Employee</TableHead>
                    {matrixSops.map((s) => (
                      <TableHead key={s.id} className="whitespace-nowrap text-xs">
                        {s.sopNumber}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEmployees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {e.firstName} {e.lastName}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {e.employeeCode}
                        </span>
                      </TableCell>
                      {matrixSops.map((s) => {
                        const a = resolveLatestAssignment(assignments, e.id, s.id);
                        const status = matrixCellStatus(a, s);
                        return (
                          <TableCell key={s.id}>
                            <StatusBadge status={status} />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
