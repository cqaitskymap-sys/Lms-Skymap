"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { listEmployeesForLifecycle } from "@/lib/services/lifecycle";
import { listSopsDetailed } from "@/lib/services/sops";
import { listTrainingAssignments } from "@/lib/services/training";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Employee, SopDocument, TrainingAssignment } from "@/types";

function cellStatus(a: TrainingAssignment | undefined) {
  if (!a) return "not_assigned";
  if (a.status === "passed") return "passed";
  if (a.status === "failed") return "failed";
  return a.status;
}

export default function MatrixPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sops, setSops] = useState<SopDocument[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, sopList, asg] = await Promise.all([
        listEmployeesForLifecycle(),
        listSopsDetailed({ status: "approved" }),
        listTrainingAssignments(),
      ]);
      setEmployees(emps);
      setSops(sopList);
      setAssignments(asg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-training-updated", onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    window.addEventListener("pharma-sops-updated", onUpdate);
    return () => {
      window.removeEventListener("pharma-training-updated", onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
      window.removeEventListener("pharma-sops-updated", onUpdate);
    };
  }, [refresh]);

  const findAsg = useMemo(() => {
    return (employeeId: string, sopId: string) =>
      assignments.find((a) => a.employeeId === employeeId && a.sopId === sopId);
  }, [assignments]);

  const exportMatrix = () => {
    if (!employees.length || !sops.length) {
      toast.error("No employees or SOPs to export yet");
      return;
    }
    const rows = employees.map((e) => {
      const row: Record<string, string> = {
        Employee: `${e.firstName} ${e.lastName}`,
        Code: e.employeeCode,
      };
      for (const s of sops) {
        const a = findAsg(e.id, s.id);
        row[s.sopNumber] = a ? a.status : "not_assigned";
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Training Matrix");
    XLSX.writeFile(wb, "training-matrix.xlsx");
    toast.success("Matrix exported");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Matrix</h1>
          <p className="text-muted-foreground">Employee × SOP compliance grid</p>
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
            {employees.length} employees · {sops.length} approved SOPs · {assignments.length}{" "}
            assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading matrix…
            </div>
          ) : !employees.length || !sops.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No matrix data yet.{" "}
              <Link href="/dashboard/employees" className="text-primary underline">
                Add employees
              </Link>{" "}
              and{" "}
              <Link href="/dashboard/sops" className="text-primary underline">
                approve SOPs
              </Link>
              , then assign training.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">Employee</TableHead>
                    {sops.map((s) => (
                      <TableHead key={s.id} className="whitespace-nowrap text-xs">
                        {s.sopNumber}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {e.firstName} {e.lastName}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {e.employeeCode}
                        </span>
                      </TableCell>
                      {sops.map((s) => {
                        const a = findAsg(e.id, s.id);
                        return (
                          <TableCell key={s.id}>
                            <StatusBadge status={cellStatus(a)} />
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
