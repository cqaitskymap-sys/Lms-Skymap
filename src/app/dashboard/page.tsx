"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  GraduationCap,
  FileText,
  Award,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ROLE_DASHBOARD_ROUTES } from "@/lib/rbac/permissions";
import { DEMO_STATS, DEMO_AUDIT, DEMO_ASSIGNMENTS } from "@/lib/demo/data";
import { StatCard } from "@/components/shared/stat-card";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { role, profile, isDemo } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role && role !== "super_admin") {
      const route = ROLE_DASHBOARD_ROUTES[role];
      if (route && route !== "/dashboard") router.replace(route);
    }
  }, [role, router]);

  const stats = DEMO_STATS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, {profile?.displayName?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          Compliance overview{isDemo ? " · Demo data" : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Employees" value={stats.totalEmployees} icon={Users} description="Active workforce" />
        <StatCard title="Compliance rate" value={`${stats.complianceRate}%`} icon={CheckCircle2} trend={{ value: 2.4, label: "vs last month" }} />
        <StatCard title="Pending assessments" value={stats.pendingAssessments} icon={ClipboardList} />
        <StatCard title="Overdue trainings" value={stats.overdueTrainings} icon={AlertTriangle} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active trainings" value={stats.activeTrainings} icon={GraduationCap} />
        <StatCard title="Certificates issued" value={stats.certificatesIssued} icon={Award} />
        <StatCard title="SOP revisions" value={stats.sopRevisionsThisMonth} icon={FileText} description="This month" />
        <StatCard title="Inductions in progress" value={stats.inductionInProgress} icon={BookOpen} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent training assignments</CardTitle>
            <CardDescription>Latest SOP training status</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_ASSIGNMENTS.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.id}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>{a.score != null ? `${a.score}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity timeline</CardTitle>
            <CardDescription>Audit trail snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityTimeline items={DEMO_AUDIT} />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Last refreshed {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
}
