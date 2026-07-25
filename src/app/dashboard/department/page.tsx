"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DEMO_ASSIGNMENTS, DEMO_EMPLOYEES } from "@/lib/demo/data";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DeptDashboardPage() {
  const deptEmployees = DEMO_EMPLOYEES.filter((e) => e.departmentId === "dept_qa");

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
            description={`${deptEmployees.length} team members in focus`}
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
                {DEMO_ASSIGNMENTS.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.id}</TableCell>
                    <TableCell>{a.employeeId}</TableCell>
                    <TableCell>{a.sopId}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      </MotionItem>
    </DashboardShell>
  );
}
