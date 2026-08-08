"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useDepartments } from "@/hooks/use-departments";
import { departmentLabel } from "@/lib/services/departments";
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
  const { profile } = useAuth();
  const deptId = profile?.departmentId;
  const { departments } = useDepartments();
  const deptName = departmentLabel(departments, deptId);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sops, setSops] = useState<SopDocument[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, sopList, asg] = await Promise.all([
        listEmployeesForLifecycle(),
        listSopsDetailed({ status: "approved" }),
        listTrainingAssignments(),
      ]);
      setEmployees(emps);
      setSops(sopList);
      setAssignments(asg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load department data");
      setEmployees([]);
      setSops([]);
      setAssignments([]);
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

  const teamEmployees = useMemo(() => {
    if (!deptId) return employees;
    return employees.filter((e) => e.departmentId === deptId);
  }, [employees, deptId]);

  const teamEmployeeIds = useMemo(
    () => new Set(teamEmployees.map((e) => e.id)),
    [teamEmployees]
  );

  const deptSops = useMemo(() => {
    if (!deptId) return sops;
    return sops.filter((s) => s.departmentIds?.includes(deptId));
  }, [sops, deptId]);

  const teamAssignments = useMemo(() => {
    if (!deptId) return assignments;
    return assignments.filter(
      (a) => a.departmentId === deptId || teamEmployeeIds.has(a.employeeId)
    );
  }, [assignments, deptId, teamEmployeeIds]);

  const empName = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };
  const sopLabel = (id: string) => {
    const s = sops.find((x) => x.id === id);
    return s ? `${s.sopNumber} — ${s.title}` : id;
  };

  return (
    <DashboardShell
      role="department_head"
      title="Department Dashboard"
      subtitle={
        deptId
          ? `${deptName} — JD, TNI, team training & compliance`
          : "Assign a department to your account to scope this view"
      }
    >
      <MotionItem>
        <GlassCard>
          <GlassCardHeader
            title="Department training status"
            description={
              deptId
                ? `${teamEmployees.length} team member(s) · ${teamAssignments.length} assignment(s)`
                : "Organization-wide view (no department on profile)"
            }
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
            ) : error ? (
              <p className="py-6 text-center text-sm text-destructive">{error}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>SOP</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        <p>No training assignments for your department yet.</p>
                        <p className="mt-1 text-xs">
                          Assign SOP training from the Training page
                          {deptSops.length > 0
                            ? ` (${deptSops.length} approved SOP(s) in your department)`
                            : ""}
                          .
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    teamAssignments.slice(0, 12).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{empName(a.employeeId)}</TableCell>
                        <TableCell className="max-w-xs truncate">{sopLabel(a.sopId)}</TableCell>
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
