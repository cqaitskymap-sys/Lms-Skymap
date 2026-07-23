"use client";

import { BookOpen, Award, ClipboardList, GraduationCap } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { DEMO_ASSIGNMENTS, DEMO_CERTIFICATES, DEMO_NOTIFICATIONS } from "@/lib/demo/data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

export default function EmployeeDashboardPage() {
  const pending = DEMO_ASSIGNMENTS.filter((a) =>
    ["assigned", "in_progress", "assessment_pending", "retraining"].includes(a.status)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Learning</h1>
        <p className="text-muted-foreground">Your training & assessment workspace</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active trainings" value={pending.length} icon={GraduationCap} />
        <StatCard title="Assessments due" value={1} icon={ClipboardList} />
        <StatCard title="Certificates" value={DEMO_CERTIFICATES.length} icon={Award} />
        <StatCard title="Modules" value={2} icon={BookOpen} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My assignments</CardTitle>
          <CardDescription>SOP training progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DEMO_ASSIGNMENTS.map((a) => (
            <div key={a.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium">{a.sopId === "sop_001" ? "Document Control Procedure" : "Deviation Management"}</p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  {a.score != null && <span className="text-xs text-muted-foreground">Score: {a.score}%</span>}
                </div>
                <Progress value={a.status === "passed" ? 100 : a.status === "assessment_pending" ? 75 : 40} className="mt-2 w-48" />
              </div>
              <Button size="sm" asChild>
                <Link href={a.status === "assessment_pending" ? "/dashboard/exams" : `/dashboard/training/${a.id}`}>
                  {a.status === "assessment_pending" ? "Take assessment" : a.status === "passed" ? "View certificate" : "Continue"}
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DEMO_NOTIFICATIONS.map((n) => (
            <div key={n.id} className="rounded-md border px-3 py-2">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
