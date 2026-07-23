"use client";

import { Users, GraduationCap, UserCheck, ClipboardList } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { DEMO_EMPLOYEES, DEMO_STATS } from "@/lib/demo/data";
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
import { formatDate } from "@/lib/utils";

export default function HrDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HR Dashboard</h1>
          <p className="text-muted-foreground">Employee onboarding & induction</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/employees/new">Add employee</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total employees" value={DEMO_STATS.totalEmployees} icon={Users} />
        <StatCard title="Induction in progress" value={DEMO_STATS.inductionInProgress} icon={GraduationCap} />
        <StatCard title="Ready for handover" value={1} icon={UserCheck} />
        <StatCard title="Pending assessments" value={DEMO_STATS.pendingAssessments} icon={ClipboardList} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent employees</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>DOJ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Induction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_EMPLOYEES.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link href={`/dashboard/employees/${e.id}`} className="font-medium text-primary hover:underline">
                      {e.employeeCode}
                    </Link>
                  </TableCell>
                  <TableCell>{e.firstName} {e.lastName}</TableCell>
                  <TableCell>{e.designation}</TableCell>
                  <TableCell>{formatDate(e.dateOfJoining)}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell><StatusBadge status={e.inductionStatus} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
