"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { listOjtAssignments, releaseOjtSelfStudy } from "@/lib/services/ojt";
import { toOjtActor } from "@/lib/ojt/actor";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import { monthName } from "@/lib/ojt/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { OjtEmptyState } from "@/components/ojt/ojt-empty-state";
import { OjtPageHint } from "@/components/ojt/ojt-page-hint";
import { ojtStatusLabel } from "@/lib/ojt/next-action";
import type { OjtAssignment } from "@/types/ojt";

function isSelfStudyQueue(row: OjtAssignment): boolean {
  if (row.selfStudy) {
    return ["selected", "assigned", "in_progress"].includes(row.status);
  }
  return ["draft", "selected", "assigned"].includes(row.status);
}

export default function OjtSchedulePage() {
  const { profile } = useAuth();
  const canSchedule = profile?.role ? hasPermission(profile.role, "ojt:schedule") : false;
  const [rows, setRows] = useState<OjtAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const releasing = useRef(false);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const filters =
        profile?.role === "department_head" && profile.departmentId
          ? { departmentId: profile.departmentId }
          : undefined;
      const all = await listOjtAssignments(filters);
      setRows(all.filter(isSelfStudyQueue));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load self-study queue");
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

  const waiting = rows.filter((row) => !row.selfStudy);

  useEffect(() => {
    if (!canSchedule || !profile || releasing.current || waiting.length === 0) return;
    releasing.current = true;
    const actor = toOjtActor(profile);
    void (async () => {
      try {
        for (const row of waiting) {
          await releaseOjtSelfStudy(row.id, actor);
        }
        toast.success("Self study started. Employees log in, read the SOP, then take the exam. No certificate.");
        await refresh({ silent: true });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start self study");
      } finally {
        releasing.current = false;
      }
    })();
  }, [canSchedule, profile, waiting, refresh]);

  const selected = rows.find((row) => row.id === selectedId) || rows[0];

  const startOne = async (row: OjtAssignment) => {
    if (!profile) return;
    setBusy(true);
    try {
      await releaseOjtSelfStudy(row.id, toOjtActor(profile));
      toast.success(`${row.employeeName} can now log in, read the SOP, and take the exam`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start self study");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Step 4 — Self study</h1>
        <p className="text-muted-foreground">
          OJT has no trainer. Assigned people log in with their employee ID, read the SOP, then take the exam.
        </p>
      </div>
      <OjtPageHint title="No certificate">
        Passing this exam closes the OJT record. It does not generate a training certificate.
      </OjtPageHint>
      {!canSchedule ? (
        <p className="text-sm text-muted-foreground">You can view self study, but you cannot start it.</p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assigned people</CardTitle>
            <CardDescription>They study the SOP themselves. Nobody books a trainer or a room.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <OjtEmptyState
                title="Nobody is assigned"
                description="First select people in step 3. They will appear here for self study."
                actionHref="/dashboard/ojt/matrix"
                actionLabel="Select people"
              />
            ) : (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full rounded-lg border p-3 text-left ${selected?.id === row.id ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{row.employeeName}</span>
                        <StatusBadge status={row.status} label={ojtStatusLabel(row.status, row.selfStudy)} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {row.trainingTopic} · {monthName(row.plannedExecutionMonth)} {row.year}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What the employee does</CardTitle>
            <CardDescription>
              {selected
                ? `${selected.employeeName} · ${selected.trainingTopic}`
                : "Select a person on the left."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {selected ? (
              <>
                <p>1. Log in with employee ID {selected.employeeCode}.</p>
                <p>2. Read {selected.sopNumber || selected.trainingTopic}.</p>
                <p>3. Take the exam after the SOP is finished.</p>
                <p className="text-muted-foreground">A certificate is not issued for this OJT.</p>
                {selected.sopId ? (
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/sops/${selected.sopId}`}>Open SOP</Link>
                  </Button>
                ) : (
                  <p className="text-amber-700 dark:text-amber-300">
                    This topic has no SOP linked. Add the SOP on the topic before the employee can study.
                  </p>
                )}
                {!selected.selfStudy && canSchedule ? (
                  <Button disabled={busy} onClick={() => void startOne(selected)}>
                    Start self study
                  </Button>
                ) : null}
                <Button asChild variant="outline">
                  <Link href={`/dashboard/ojt/assignments/${selected.id}`}>Open record</Link>
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">Click a person on the left first.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
