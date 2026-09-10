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
import { listOjtAssignments } from "@/lib/services/ojt";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import type { TrainingSession } from "@/types";
import type { OjtAssignment } from "@/types/ojt";

export default function TrainerDashboardPage() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [ojtRows, setOjtRows] = useState<OjtAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listTrainingSessions();
      const mine = profile?.uid
        ? all.filter((s) => s.trainerId === profile.uid || s.createdBy === profile.uid)
        : [];
      setSessions(mine);
      if (profile?.uid) {
        setOjtRows(await listOjtAssignments({ trainerId: profile.uid }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.uid]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    window.addEventListener(OJT_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
      window.removeEventListener(OJT_UPDATED_EVENT, onUpdate);
    };
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
      ) : error ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : sessions.length === 0 && ojtRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No SOP sessions or OJT assigned yet. Department Head can assign training from the Training
          and OJT pages.
        </p>
      ) : (
        <div className="space-y-6">
          {sessions.length > 0 && (
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
          {ojtRows.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {ojtRows.slice(0, 8).map((a) => (
                <MotionItem key={a.id}>
                  <GlassCard hover className="h-full">
                    <GlassCardHeader
                      title={a.trainingTopic}
                      description={`${a.employeeName} · ${a.employeeCode}`}
                      action={<StatusBadge status={a.status} />}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">On Job Training</span>
                      <Button size="sm" asChild>
                        <Link href={`/dashboard/ojt/assignments/${a.id}`}>
                          {a.status === "scheduled" || a.status === "in_progress" ? "Execute" : "Open"}
                        </Link>
                      </Button>
                    </div>
                  </GlassCard>
                </MotionItem>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
