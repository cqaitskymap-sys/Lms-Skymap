"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { listEmployeesForLifecycle, assignSopLifecycle, assignTrainerLifecycle, validateTrainingAssignmentLifecycle } from "@/lib/services/lifecycle";
import { listSopsDetailed } from "@/lib/services/sops";
import { listStaffUsers } from "@/lib/services/users";
import {
  assignSopTraining,
  ensureTrainerProfilesFromUsers,
  listTrainingAssignments,
  listTrainers,
  type TrainingAssignmentFilters,
} from "@/lib/services/training";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Employee, SopDocument, TrainerProfile, TrainingAssignment, UserProfile } from "@/types";

export default function TrainingPage() {
  const { profile, can } = useAuth();
  const canReadUsers = profile?.role ? hasPermission(profile.role, "users:read") : false;
  const [sopId, setSopId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sops, setSops] = useState<(SopDocument & { version?: { id: string } })[]>([]);
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const assignmentFilters = useMemo((): TrainingAssignmentFilters | undefined => {
    if (!profile) return undefined;
    if (profile.role === "employee" && profile.employeeId) {
      return { employeeId: profile.employeeId };
    }
    if (profile.role === "trainer") {
      return { trainerUserId: profile.uid };
    }
    if (profile.role === "department_head" && profile.departmentId) {
      return { departmentId: profile.departmentId };
    }
    return undefined;
  }, [profile]);

  const assignableEmployees = useMemo(() => {
    if (profile?.role === "department_head" && profile.departmentId) {
      return employees.filter((e) => e.departmentId === profile.departmentId);
    }
    return employees;
  }, [employees, profile?.departmentId, profile?.role]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const staffPromise = canReadUsers
        ? listStaffUsers().catch(() => [] as UserProfile[])
        : Promise.resolve([] as UserProfile[]);

      // Employees cannot list the employees collection — load self only.
      const employeesPromise =
        profile?.role === "employee"
          ? profile.employeeId
            ? listEmployeesForLifecycle({ employeeId: profile.employeeId })
            : Promise.resolve([] as Employee[])
          : listEmployeesForLifecycle();

      const [emps, sopList, staff, asg, existingTrainers] = await Promise.all([
        employeesPromise,
        listSopsDetailed({ status: "approved" }),
        staffPromise,
        listTrainingAssignments(assignmentFilters),
        listTrainers(),
      ]);
      setEmployees(emps);
      setSops(sopList);
      setUsers(staff);
      setAssignments(asg);
      let trainerProfiles = existingTrainers;
      if (staff.length > 0) {
        trainerProfiles = await ensureTrainerProfilesFromUsers(staff);
      }
      setTrainers(trainerProfiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load training data");
    } finally {
      setLoading(false);
    }
  }, [canReadUsers, assignmentFilters, profile?.role, profile?.employeeId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAssign = async () => {
    if (!profile) return;
    if (!sopId || !trainerId || !selectedEmployees.length) {
      toast.error("Select SOP, trainer, and at least one employee");
      return;
    }
    const sop = sops.find((s) => s.id === sopId);
    if (!sop?.currentVersionId && !sop?.version?.id) {
      toast.error("Selected SOP has no approved version");
      return;
    }
    const departmentId =
      employees.find((e) => e.id === selectedEmployees[0])?.departmentId ||
      sop.departmentIds[0] ||
      "";
    if (!departmentId) {
      toast.error("Department missing on employee/SOP");
      return;
    }

    const deptMismatch = selectedEmployees.filter((id) => {
      const emp = employees.find((e) => e.id === id);
      return emp && emp.departmentId !== departmentId;
    });
    if (deptMismatch.length) {
      toast.error("All selected employees must belong to the same department");
      return;
    }

    const lifecycleErrors: string[] = [];
    for (const empId of selectedEmployees) {
      try {
        await validateTrainingAssignmentLifecycle(empId);
      } catch (err) {
        lifecycleErrors.push(err instanceof Error ? err.message : String(err));
      }
    }
    if (lifecycleErrors.length) {
      toast.error(lifecycleErrors[0]!);
      return;
    }

    setBusy(true);
    try {
      const { session, skipped } = await assignSopTraining({
        employeeIds: selectedEmployees,
        sopId,
        sopVersionId: sop.currentVersionId || sop.version!.id,
        trainerId,
        departmentId,
        dueDate: dueDate || undefined,
        actorId: profile.uid,
        sessionTitle: `${sop.sopNumber} training`,
      });

      const actor = {
        uid: profile.uid,
        name: profile.displayName,
        role: profile.role,
      };
      for (const empId of selectedEmployees) {
        if (skipped.includes(empId)) continue;
        await assignTrainerLifecycle(empId, trainerId, actor);
        await assignSopLifecycle(empId, sopId, actor);
      }

      const msg =
        skipped.length > 0
          ? `Training assigned for ${selectedEmployees.length - skipped.length} employee(s) · ${skipped.length} skipped (duplicate)`
          : `Training assigned · session ${session.id}`;
      toast.success(msg);
      setSelectedEmployees([]);
      setSopId("");
      setTrainerId("");
      setDueDate("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setBusy(false);
    }
  };

  const empName = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };
  const sopLabel = (id: string) => {
    const s = sops.find((x) => x.id === id);
    return s ? `${s.sopNumber}` : id;
  };
  const trainerName = (id?: string) => {
    if (!id) return "—";
    const t = trainers.find((x) => x.id === id || x.userId === id);
    const u = users.find((x) => x.uid === (t?.userId || id));
    return u?.displayName || id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training</h1>
        <p className="text-muted-foreground">
          Assign SOP training, schedule sessions, track progress
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <RequirePermission permission="training:write" fallback={null}>
        <Card>
          <CardHeader>
            <CardTitle>Assign SOP training</CardTitle>
            <CardDescription>
              Department Head assigns SOP + Trainer to employees
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>SOP</Label>
                <Select value={sopId} onValueChange={setSopId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select SOP" />
                  </SelectTrigger>
                  <SelectContent>
                    {sops.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No approved SOPs yet
                      </SelectItem>
                    ) : (
                      sops.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.sopNumber} — {s.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trainer</Label>
                <Select value={trainerId} onValueChange={setTrainerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select trainer" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainers.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No trainers listed yet
                      </SelectItem>
                    ) : (
                      trainers.map((t) => {
                        const u = users.find((x) => x.uid === t.userId);
                        return (
                          <SelectItem key={t.id} value={t.userId}>
                            {u?.displayName || t.userId}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Employees</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No employees available.{" "}
                    {can("employees:onboard") && (
                      <Link href="/dashboard/employees/new" className="text-primary underline">
                        Onboard one
                      </Link>
                    )}
                  </p>
                ) : (
                  assignableEmployees.map((e) => (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-accent/50"
                    >
                      <Checkbox
                        checked={selectedEmployees.includes(e.id)}
                        onCheckedChange={() => toggleEmployee(e.id)}
                      />
                      <span className="text-sm">
                        {e.firstName} {e.lastName} · {e.employeeCode}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <Button disabled={busy} onClick={() => void handleAssign()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign training
            </Button>
          </CardContent>
        </Card>
      </RequirePermission>

      <Card>
        <CardHeader>
          <CardTitle>Training assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>SOP</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No training assignments yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.id}</TableCell>
                      <TableCell>{empName(a.employeeId)}</TableCell>
                      <TableCell>{sopLabel(a.sopId)}</TableCell>
                      <TableCell>{trainerName(a.trainerId)}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell>{a.score != null ? `${a.score}%` : "—"}</TableCell>
                      <TableCell>
                        {a.sessionId && (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/dashboard/training/sessions/${a.sessionId}`}>
                              Session
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
