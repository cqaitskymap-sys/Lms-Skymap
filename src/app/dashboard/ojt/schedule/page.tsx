"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { listOjtAssignments, listOjtStaffOptions, scheduleOjtAssignment } from "@/lib/services/ojt";
import { toOjtActor } from "@/lib/ojt/actor";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import { calendarDateToIso, dateFallsInMonth, monthName } from "@/lib/ojt/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { OjtEmptyState } from "@/components/ojt/ojt-empty-state";
import { ojtStatusLabel } from "@/lib/ojt/next-action";
import type { OjtAssignment } from "@/types/ojt";

export default function OjtSchedulePage() {
  const { profile } = useAuth();
  const canSchedule = profile?.role ? hasPermission(profile.role, "ojt:schedule") : false;
  const [rows, setRows] = useState<OjtAssignment[]>([]);
  const [trainers, setTrainers] = useState<{ uid: string; displayName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [location, setLocation] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [deviationReason, setDeviationReason] = useState("");

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const filters =
        profile?.role === "department_head" && profile.departmentId
          ? { departmentId: profile.departmentId }
          : profile?.role === "trainer"
            ? { trainerId: profile.uid }
            : undefined;
      const all = await listOjtAssignments(filters);
      setRows(all.filter((a) => ["selected", "assigned", "rescheduled"].includes(a.status)));
      const staff = await listOjtStaffOptions();
      setTrainers(staff.filter((u) => u.role === "trainer" || u.role === "department_head"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load schedule queue");
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

  const selected = rows.find((r) => r.id === selectedId);

  useEffect(() => {
    if (selected?.trainerId) setTrainerId(selected.trainerId);
  }, [selected?.trainerId]);

  const handleSave = async () => {
    if (!profile || !selected || !date || !trainerId) {
      toast.error("Select OJT, trainer, and execution date");
      return;
    }
    setBusy(true);
    try {
      const trainer = trainers.find((t) => t.uid === trainerId);
      const outside =
        selected && date
          ? !dateFallsInMonth(calendarDateToIso(date), selected.year, selected.plannedExecutionMonth)
          : false;
      if (outside && !deviationReason.trim()) {
        toast.error("Date is outside the planned execution month. Record an authorized deviation reason.");
        setBusy(false);
        return;
      }
      await scheduleOjtAssignment(
        selected.id,
        {
          executionDate: date,
          startTime,
          endTime,
          location,
          trainerId,
          trainerName: trainer?.displayName,
          deviation: outside
            ? {
                reason: deviationReason.trim(),
                approvedBy: profile.uid,
                approvedByName: profile.displayName,
                approvalDate: new Date().toISOString(),
              }
            : undefined,
        },
        toOjtActor(profile)
      );
      toast.success("OJT scheduled");
      setSelectedId("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Schedule failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Book an OJT date</h1>
        <p className="text-muted-foreground">
          Pick a person from the left, then set trainer, date (must be in the planned month), time and location.
        </p>
      </div>
      {!canSchedule ? (
        <p className="text-sm text-muted-foreground">You can view assigned OJT but cannot schedule sessions.</p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Waiting for a date</CardTitle>
            <CardDescription>Selected people who do not have a session yet</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <OjtEmptyState
                title="Nobody is waiting"
                description="Select employees on the matrix first. They will appear here so you can book a shop-floor date."
                actionHref="/dashboard/ojt/matrix"
                actionLabel="Open employee matrix"
              />
            ) : (
              <ul className="space-y-2">
                {rows.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full rounded-lg border p-3 text-left ${selectedId === a.id ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{a.employeeName}</span>
                        <StatusBadge status={a.status} label={ojtStatusLabel(a.status)} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {a.trainingTopic} · {monthName(a.plannedExecutionMonth)} {a.year}
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
            <CardTitle>When and where</CardTitle>
            <CardDescription>
              {selected
                ? `${selected.employeeName} · ${selected.trainingTopic}. Date must be in ${monthName(selected.plannedExecutionMonth)} ${selected.year}.`
                : "Select a person on the left to fill in the session details."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="space-y-1">
              <Label>Trainer</Label>
              <Select value={trainerId || undefined} onValueChange={setTrainerId} disabled={!canSchedule}>
                <SelectTrigger>
                  <SelectValue placeholder="Trainer" />
                </SelectTrigger>
                <SelectContent>
                  {trainers.map((u) => (
                    <SelectItem key={u.uid} value={u.uid}>
                      {u.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Execution date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!canSchedule} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>End</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dispensing room / Line 2" />
            </div>
            {selected && date && !dateFallsInMonth(calendarDateToIso(date), selected.year, selected.plannedExecutionMonth) && (
              <div className="space-y-1 rounded-lg border border-amber-300/60 p-3">
                <Label>Authorized deviation reason</Label>
                <Textarea
                  value={deviationReason}
                  onChange={(e) => setDeviationReason(e.target.value)}
                  placeholder="Why is training outside the planned execution month? Original planned month is kept."
                />
                <p className="text-xs text-muted-foreground">
                  Original planned month ({monthName(selected.plannedExecutionMonth)} {selected.year}) is not overwritten.
                </p>
              </div>
            )}
            <Button disabled={!canSchedule || busy || !selected} onClick={() => void handleSave()}>
              Book this session
            </Button>
            {selected && (
              <Button asChild variant="outline">
                <Link href={`/dashboard/ojt/assignments/${selected.id}`}>Open record</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
