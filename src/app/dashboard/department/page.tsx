"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { listEmployeesForLifecycle } from "@/lib/services/lifecycle";
import { listSopsDetailed } from "@/lib/services/sops";
import { listTrainingAssignments } from "@/lib/services/training";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { StatusBadge } from "@/components/shared/status-badge";
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

export default function DeptDashboardPage() {
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
    return () => {
      window.removeEventListener("pharma-training-updated", onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
    };
  }, [refresh]);

  const empName = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };
  const sopLabel = (id: string) => {
    const s = sops.find((x) => x.id === id);
    return s ? s.sopNumber : id;
  };

  return (
    <DashboardShell
      role="department_head"
      title="Department Dashboard"
      subtitle="JD, TNI, team training & compliance"
    >
      <MotionItem>
        <GlassCard>
          <GlassCardHeader
            title="Department training status"
            description="Team training assignments"
            action={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/jd">JDs</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/dashboard/training">Assign</Link>
                </Button>
              </div>
            }
          />
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>SOP</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No department training data yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignments.slice(0, 12).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.id}</TableCell>
                        <TableCell>{empName(a.employeeId)}</TableCell>
                        <TableCell>{sopLabel(a.sopId)}</TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </GlassCard>
      </MotionItem>
    </DashboardShell>
  );
}
