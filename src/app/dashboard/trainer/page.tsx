"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { listTrainingSessions } from "@/lib/services/training";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";
import type { TrainingSession } from "@/types";

export default function TrainerDashboardPage() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listTrainingSessions();
      const mine = profile?.uid
        ? all.filter((s) => s.trainerId === profile.uid || s.createdBy === profile.uid)
        : all;
      setSessions(mine.length ? mine : all);
    } finally {
      setLoading(false);
    }
  }, [profile?.uid]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return (
    <DashboardShell
      role="trainer"
      title="Trainer Dashboard"
      subtitle="Sessions, attendance & delivery performance"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No training sessions assigned yet. Department Head can assign SOP training from
          the Training page.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((s) => (
            <MotionItem key={s.id}>
              <GlassCard hover className="h-full">
                <GlassCardHeader
                  title={s.title}
                  description={formatDateTime(s.scheduledAt)}
                  action={<StatusBadge status={s.status} />}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {s.attendance?.length || 0} attendees
                  </span>
                  <Button size="sm" asChild>
                    <Link href={`/dashboard/training/sessions/${s.id}`}>
                      {s.status === "scheduled" || s.status === "in_progress"
                        ? "Conduct"
                        : "View"}
                    </Link>
                  </Button>
                </div>
              </GlassCard>
            </MotionItem>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
