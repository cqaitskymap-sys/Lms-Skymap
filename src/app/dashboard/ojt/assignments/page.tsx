"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { listOjtAssignments, listOjtStaffOptions, deleteOjtAssignment, type OjtAssignmentFilters } from "@/lib/services/ojt";
import { toOjtActor } from "@/lib/ojt/actor";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import { OJT_STATUS_LABELS, currentCalendarYear, monthName } from "@/lib/ojt/constants";
import { displayOjtStatus } from "@/lib/ojt/workflow";
import { ojtNextAction, ojtStatusLabel } from "@/lib/ojt/next-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { OjtEmptyState } from "@/components/ojt/ojt-empty-state";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { AdminEditButton } from "@/components/auth/admin-edit-button";
import { OjtAssignmentEditDialog } from "@/components/ojt/ojt-admin-dialogs";
import type { OjtAssignment, OjtStatus } from "@/types/ojt";

const STATUSES: Array<OjtStatus | "all"> = [
  "all",
  "selected",
  "assigned",
  "scheduled",
  "in_progress",
  "trainer_completed",
  "employee_acknowledged",
  "verification_pending",
  "qa_pending",
  "completed",
  "failed",
  "retraining_required",
  "rescheduled",
  "cancelled",
];

export default function OjtAssignmentsPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<OjtAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OjtStatus | "all">("all");
  const [year, setYear] = useState(String(currentCalendarYear()));
  const [editing, setEditing] = useState<OjtAssignment | null>(null);
  const [trainers, setTrainers] = useState<{ uid: string; displayName: string }[]>([]);

  const filters = useMemo((): OjtAssignmentFilters => {
    const base: OjtAssignmentFilters = { year: Number(year) };
    if (profile?.role === "employee" && profile.employeeId) base.employeeId = profile.employeeId;
    if (profile?.role === "trainer") base.trainerId = profile.uid;
    if (profile?.role === "department_head" && profile.departmentId) {
      base.departmentId = profile.departmentId;
    }
    if (status !== "all") base.status = status;
    return base;
  }, [profile, status, year]);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      if (profile?.role === "employee" && !profile.employeeId) {
        setRows([]);
        return;
      }
      const [asg, staff] = await Promise.all([
        listOjtAssignments(filters),
        listOjtStaffOptions().catch(() => []),
      ]);
      setRows(asg);
      setTrainers(staff.filter((u) => u.role === "trainer" || u.role === "department_head" || u.role === "super_admin"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh({ silent: true });
    window.addEventListener(OJT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(OJT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const visible = rows.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${a.employeeName} ${a.employeeCode} ${a.trainingTopic} ${a.sopNumber || ""} ${a.trainerName || ""}`
      .toLowerCase()
      .includes(q);
  });

  const canSchedule = profile?.role ? hasPermission(profile.role, "ojt:schedule") : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {profile?.role === "employee" ? "My On Job Training" : "OJT records"}
        </h1>
        <p className="text-muted-foreground">
          {profile?.role === "employee"
            ? "Open a record to acknowledge training after your trainer has scored you."
            : "Search a person or topic, then open the record to see the next step."}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Find a record</CardTitle>
          <CardDescription>Filter by year and workflow status</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            className="max-w-xs"
            placeholder="Name, topic, SOP, or trainer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Input type="number" className="w-28" value={year} onChange={(e) => setYear(e.target.value)} />
          <Select value={status} onValueChange={(v) => setStatus(v as OjtStatus | "all")}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All statuses" : OJT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canSchedule && (
            <Button asChild variant="outline">
              <Link href="/dashboard/ojt/schedule">Schedule OJT</Link>
            </Button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : visible.length === 0 ? (
            <OjtEmptyState
              title="No OJT records match"
              description={
                profile?.role === "employee"
                  ? "When your department selects you for a practical topic, it will show up here."
                  : "Select people on the employee matrix to create records, or change the filters above."
              }
              actionHref={canSchedule ? "/dashboard/ojt/matrix" : undefined}
              actionLabel={canSchedule ? "Open employee matrix" : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Topic / SOP</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next step</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((a) => {
                  const next = ojtNextAction(a, profile?.role);
                  return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.employeeName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{a.employeeCode}</div>
                    </TableCell>
                    <TableCell>
                      <div>{a.trainingTopic}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {a.sopNumber || a.referenceDocumentNumber}
                        {a.sopVersionNumber ? ` · v${a.sopVersionNumber}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {monthName(a.plannedExecutionMonth)} {a.year}
                    </TableCell>
                    <TableCell>{a.trainerName || "Not assigned"}</TableCell>
                    <TableCell>
                      <StatusBadge status={displayOjtStatus(a)} label={ojtStatusLabel(displayOjtStatus(a))} />
                    </TableCell>
                    <TableCell className="max-w-[16rem] text-sm text-muted-foreground">
                      {next.title}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <AdminEditButton onClick={() => setEditing(a)} />
                        <Button size="sm" variant={next.canAct ? "default" : "outline"} asChild>
                          <Link href={`/dashboard/ojt/assignments/${a.id}`}>
                            {next.canAct ? "Continue" : "Open"}
                          </Link>
                        </Button>
                        <AdminDeleteButton
                          confirmTitle={`Delete OJT for ${a.employeeName}?`}
                          confirmDescription="This OJT record will be removed permanently. Only Super Admin can delete."
                          successMessage="OJT record deleted"
                          onDelete={async () => {
                            if (!profile) throw new Error("Not signed in");
                            await deleteOjtAssignment(a.id, toOjtActor(profile));
                            await refresh({ silent: true });
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <OjtAssignmentEditDialog
        assignment={editing}
        trainers={trainers}
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        onSaved={() => refresh({ silent: true })}
      />
    </div>
  );
}
