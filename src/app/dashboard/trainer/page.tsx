"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

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
    <DashboardShell
      role="trainer"
      title="Trainer Dashboard"
      subtitle="Sessions, attendance & delivery performance"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {SESSIONS.map((s) => (
          <MotionItem key={s.id}>
            <GlassCard hover className="h-full">
              <GlassCardHeader
                title={s.title}
                description={formatDateTime(s.scheduledAt)}
                action={<StatusBadge status={s.status} />}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {s.attendees} attendees
                </span>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/training/sessions/${s.id}`}>
                    {s.status === "scheduled" ? "Conduct" : "View"}
                  </Link>
                </Button>
              </div>
            </GlassCard>
          </MotionItem>
        ))}
      </div>
    </DashboardShell>
  );
}
