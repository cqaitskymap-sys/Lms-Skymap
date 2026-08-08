"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { listEmployeesForLifecycle, markTrainingLifecycle } from "@/lib/services/lifecycle";
import { getEmployee } from "@/lib/services/employees";
import {
  completeTrainingSession,
  getSessionAssignments,
  getTrainingSession,
  markAttendance,
} from "@/lib/services/training";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { Employee, TrainingAssignment, TrainingAttendance, TrainingSession } from "@/types";

export default function TrainingSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile } = useAuth();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<TrainingAttendance[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const canListAssignments =
        profile?.role === "super_admin" ||
        profile?.role === "hr" ||
        profile?.role === "qa" ||
        profile?.role === "department_head" ||
        profile?.role === "trainer";

      const linkedPromise =
        canListAssignments
          ? getSessionAssignments(id)
          : profile?.employeeId
            ? getSessionAssignments(id, { employeeId: profile.employeeId })
            : Promise.resolve([] as TrainingAssignment[]);

      const [s, linked] = await Promise.all([
        getTrainingSession(id),
        linkedPromise,
      ]);
      setSession(s);

      const rosterIds = new Set<string>();
      for (const a of linked) rosterIds.add(a.employeeId);
      for (const a of s?.attendance || []) rosterIds.add(a.employeeId);

      let emps: Employee[] = [];
      if (canListAssignments) {
        emps = await listEmployeesForLifecycle().catch(() => [] as Employee[]);
      } else {
        const fetched = await Promise.all(
          [...rosterIds].map((empId) => getEmployee(empId).catch(() => null))
        );
        emps = fetched.filter((e): e is Employee => Boolean(e));
      }
      setEmployees(emps);

      if (s) {
        const roster =
          s.attendance?.length > 0
            ? s.attendance
            : linked.map((a) => ({ employeeId: a.employeeId, present: false }));
        // Employees only see their own attendance row.
        const scopedRoster =
          canListAssignments || !profile?.employeeId
            ? roster
            : roster.filter((a) => a.employeeId === profile.employeeId);
        setAttendance(scopedRoster);
        setNotes(s.notes || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [id, profile?.role, profile?.employeeId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const empName = (empId: string) => {
    const e = employees.find((x) => x.id === empId);
    return e ? `${e.firstName} ${e.lastName}` : empId;
  };

  const togglePresent = (employeeId: string) => {
    setAttendance((prev) =>
      prev.map((a) =>
        a.employeeId === employeeId
          ? {
              ...a,
              present: !a.present,
              signedAt: !a.present ? new Date().toISOString() : undefined,
            }
          : a
      )
    );
  };

  const canManageSessionFor = (s: TrainingSession | null) => {
    if (!s || !profile?.role || !profile.uid) return false;
    const canConduct = hasPermission(profile.role, "training:conduct");
    const isAssigned =
      s.trainerId === profile.uid || s.createdBy === profile.uid;
    return canConduct && (profile.role === "super_admin" || isAssigned);
  };

  const handleSaveAttendance = async () => {
    if (!profile || !canManageSessionFor(session)) return;
    setBusy(true);
    try {
      await markAttendance(id, attendance, profile.uid);
      toast.success("Attendance saved");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save attendance");
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!profile || !canManageSessionFor(session)) return;
    if (!attendance.some((a) => a.present)) {
      toast.error("Mark at least one attendee present before completing");
      return;
    }
    setBusy(true);
    try {
      await markAttendance(id, attendance, profile.uid);
      await completeTrainingSession(id, notes, profile.uid);
      const actor = {
        uid: profile.uid,
        name: profile.displayName,
        role: profile.role,
      };
      for (const a of attendance.filter((x) => x.present)) {
        try {
          await markTrainingLifecycle(a.employeeId, actor);
        } catch {
          /* ignore */
        }
      }
      toast.success("Session completed — assessments unlocked for attendees");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete session");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading session…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Could not load session</h1>
        <p className="text-sm text-destructive">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/training">Back to training</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Session not found</h1>
        <p className="text-muted-foreground font-mono text-sm">{id}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/training">Back to training</Link>
        </Button>
      </div>
    );
  }

  const done = session.status === "completed";
  const canManageSession = canManageSessionFor(session);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
          <Badge variant="secondary">{session.status.replace(/_/g, " ")}</Badge>
        </div>
        <p className="text-muted-foreground font-mono text-sm">{id}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mark attendance</CardTitle>
          <CardDescription>
            Trainer records presence and completes the session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attendees assigned to this session yet.
            </p>
          ) : (
            <div className="space-y-2 rounded-md border p-3">
              {attendance.map((a) => (
                <label
                  key={a.employeeId}
                  className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-accent/50"
                >
                  <Checkbox
                    checked={a.present}
                    disabled={done || !canManageSession}
                    onCheckedChange={() => togglePresent(a.employeeId)}
                  />
                  <span className="text-sm">{empName(a.employeeId)}</span>
                </label>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Session notes</Label>
            <Textarea
              value={notes}
              disabled={done || !canManageSession}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Topics covered, Q&A summary…"
            />
          </div>

          {!canManageSession && !done && (
            <p className="text-sm text-muted-foreground">
              Only the assigned trainer can mark attendance and complete this session.
            </p>
          )}

          {!done && canManageSession && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void handleSaveAttendance()}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save attendance
              </Button>
              <Button disabled={busy} onClick={() => void handleComplete()}>
                Complete session
              </Button>
            </div>
          )}

          {done && (
            <p className="text-sm text-emerald-600">
              Session completed. Present employees can take assessment under Assessments.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
