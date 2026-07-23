"use client";

import { Calendar, Users, CheckSquare, Clock } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import Link from "next/link";

const SESSIONS = [
  {
    id: "ts_001",
    title: "Deviation Management — Classroom",
    scheduledAt: "2026-07-24T10:00:00.000Z",
    attendees: 8,
    status: "scheduled",
  },
  {
    id: "ts_002",
    title: "Document Control Refresh",
    scheduledAt: "2026-07-20T14:00:00.000Z",
    attendees: 6,
    status: "completed",
  },
];

export default function TrainerDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trainer Dashboard</h1>
        <p className="text-muted-foreground">Sessions, attendance & completion</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Upcoming sessions" value={1} icon={Calendar} />
        <StatCard title="Trainees this week" value={14} icon={Users} />
        <StatCard title="Completed sessions" value={12} icon={CheckSquare} />
        <StatCard title="Pending attendance" value={1} icon={Clock} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SESSIONS.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <CardDescription>{new Date(s.scheduledAt).toLocaleString("en-IN")}</CardDescription>
                </div>
                <StatusBadge status={s.status} />
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.attendees} attendees</span>
              <Button size="sm" asChild>
                <Link href={`/dashboard/training/sessions/${s.id}`}>
                  {s.status === "scheduled" ? "Conduct" : "View"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
