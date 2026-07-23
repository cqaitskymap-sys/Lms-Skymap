"use client";

import { Briefcase, Target, GraduationCap, Users } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { DEMO_ASSIGNMENTS, DEMO_EMPLOYEES } from "@/lib/demo/data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Department Dashboard</h1>
          <p className="text-muted-foreground">JD, TNI & SOP training assignment</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/jd">Job Descriptions</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/training">Assign training</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Team members" value={deptEmployees.length} icon={Users} />
        <StatCard title="Open JDs" value={1} icon={Briefcase} />
        <StatCard title="Open TNIs" value={1} icon={Target} />
        <StatCard title="Active trainings" value={DEMO_ASSIGNMENTS.length} icon={GraduationCap} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department training status</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
