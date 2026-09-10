"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { listOjtAssignments } from "@/lib/services/ojt";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import { displayOjtStatus } from "@/lib/ojt/workflow";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { OjtEmptyState } from "@/components/ojt/ojt-empty-state";
import { ojtNextAction, ojtStatusLabel } from "@/lib/ojt/next-action";
import type { OjtAssignment } from "@/types/ojt";

export default function OjtExecutionQueuePage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<OjtAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      if (profile?.role === "employee" && !profile.employeeId) {
        setRows([]);
        return;
      }
      const filters =
        profile?.role === "employee" && profile.employeeId
          ? { employeeId: profile.employeeId }
          : profile?.role === "trainer"
            ? { trainerId: profile.uid }
            : profile?.role === "department_head" && profile.departmentId
              ? { departmentId: profile.departmentId }
              : undefined;
      const all = await listOjtAssignments(filters);
      setRows(
        all.filter((a) =>
          ["scheduled", "rescheduled", "in_progress", "trainer_completed"].includes(a.status)
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load execution queue");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh({ silent: true });
    window.addEventListener(OJT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(OJT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conduct On Job Training</h1>
        <p className="text-muted-foreground">
          Practical demonstration on the shop floor — not a classroom exam. Open a session to start, score, or acknowledge.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Ready now</CardTitle>
            <CardDescription>Scheduled, in progress, or waiting for employee acknowledgement</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <OjtEmptyState
              title="No sessions in the queue"
              description={
                profile?.role === "trainer"
                  ? "When a department books an OJT with you as trainer, it will show up here."
                  : "Book a date first. Scheduled OJT will appear here for the trainer to start."
              }
              actionHref={
                profile?.role && hasPermission(profile.role, "ojt:schedule")
                  ? "/dashboard/ojt/schedule"
                  : "/dashboard/ojt/assignments"
              }
              actionLabel={
                profile?.role && hasPermission(profile.role, "ojt:schedule")
                  ? "Book a date"
                  : "View records"
              }
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((a) => {
                const next = ojtNextAction(a, profile?.role);
                return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{a.employeeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.trainingTopic} · {formatDate(a.actualExecutionDate)} · {a.location || "location TBD"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{next.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={displayOjtStatus(a)} label={ojtStatusLabel(displayOjtStatus(a))} />
                    <Button size="sm" asChild>
                      <Link href={`/dashboard/ojt/assignments/${a.id}`}>
                        {next.canAct ? "Continue" : "Open"}
                      </Link>
                    </Button>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
