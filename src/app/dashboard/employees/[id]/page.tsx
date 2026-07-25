"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { KeyRound, Loader2, ArrowRight } from "lucide-react";
import { DEMO_DEPARTMENTS, DEMO_INDUCTION_MODULES } from "@/lib/demo/data";
import { useAuth } from "@/contexts/auth-context";
import { useEmployeeLifecycle } from "@/hooks/use-employee-lifecycle";
import {
  advanceToNext,
  assignInductionLifecycle,
  completeInductionLifecycle,
  handoverLifecycle,
  verifyEmployee,
  type LifecycleActor,
} from "@/lib/services/lifecycle";
import { reissueCredentials, type OnboardingCredentials } from "@/lib/services/onboarding";
import { CredentialsCard } from "@/components/onboarding/credentials-card";
import { getStageDefinition, nextStage } from "@/lib/lifecycle/stages";
import { StatusBadge } from "@/components/shared/status-badge";
import { RequirePermission } from "@/components/auth/require-permission";
import { LifecycleStatusTracker } from "@/components/lifecycle/lifecycle-status-tracker";
import { LifecycleProgressBar } from "@/components/lifecycle/lifecycle-progress-bar";
import { LifecycleTimeline } from "@/components/lifecycle/lifecycle-timeline";
import { LifecycleActivityLog } from "@/components/lifecycle/lifecycle-activity-log";
import { LifecycleApprovals } from "@/components/lifecycle/lifecycle-approvals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/types";

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile, can } = useAuth();
  const { employee, events, approvals, loading, refresh } = useEmployeeLifecycle(id);
  const [selectedModules, setSelectedModules] = useState<string[]>(["ind_001"]);
  const [handoverDept, setHandoverDept] = useState("");
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<{
    creds: OnboardingCredentials;
    email: { sent: boolean; reason?: string };
  } | null>(null);

  const actor: LifecycleActor = useMemo(
    () => ({
      uid: profile?.uid || "system",
      name: profile?.displayName || "System",
      role: (profile?.role || "hr") as UserRole,
      email: profile?.email,
    }),
    [profile]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return <p className="text-muted-foreground">Employee not found.</p>;
  }

  const stage = employee.lifecycleStage || "created";
  const stageDef = getStageDefinition(stage);
  const nxt = nextStage(stage);
  const deptId = handoverDept || employee.departmentId || DEMO_DEPARTMENTS[0]?.id || "";

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    );
  };

  return (
    <RequirePermission permission="employees:read">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-muted-foreground">
              {employee.employeeCode} · {employee.designation}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={employee.status} />
            <StatusBadge status={employee.inductionStatus} />
            <StatusBadge status={stage} />
          </div>
        </div>

        {credentials && (
          <CredentialsCard
            credentials={credentials.creds}
            employeeName={`${employee.firstName} ${employee.lastName}`}
            emailStatus={credentials.email}
            onDone={() => setCredentials(null)}
          />
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lifecycle status tracker</CardTitle>
            <CardDescription>
              Created → Verification → Induction → Handover → JD → TNI → Training → Exam →
              Certificate → Qualified
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LifecycleStatusTracker currentStage={stage} />
            <LifecycleProgressBar stage={stage} progress={employee.lifecycleProgress} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <p className="text-muted-foreground">Username</p>
                <p className="font-mono font-medium">
                  {employee.username || employee.employeeCode}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{employee.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Mobile</p>
                <p className="font-medium">{employee.mobile || employee.phone || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Employment type</p>
                <p className="font-medium capitalize">{employee.employmentType || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reporting manager</p>
                <p className="font-medium">{employee.reportingManagerName || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">First-login status</p>
                <p className="font-medium capitalize">
                  {(employee.onboardingStatus || "—").replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Date of joining</p>
                <p className="font-medium">{formatDate(employee.dateOfJoining)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Department</p>
                <p className="font-medium">
                  {employee.departmentName ||
                    DEMO_DEPARTMENTS.find((d) => d.id === employee.departmentId)?.name ||
                    "Unassigned"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Current stage</p>
                <p className="font-medium">{stageDef.label}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Verified</p>
                <p className="font-medium">{formatDate(employee.verifiedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Induction completed</p>
                <p className="font-medium">{formatDate(employee.inductionCompletedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Qualified</p>
                <p className="font-medium">{formatDate(employee.qualifiedAt)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Full qualification pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <LifecycleTimeline currentStage={stage} events={events} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Activity log</CardTitle>
              <CardDescription>Automatic Firestore / demo updates</CardDescription>
            </CardHeader>
            <CardContent>
              <LifecycleActivityLog events={events} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Approval flow</CardTitle>
              <CardDescription>Pending gates for this employee</CardDescription>
            </CardHeader>
            <CardContent>
              <LifecycleApprovals
                approvals={approvals}
                actor={actor}
                onUpdated={() => void refresh()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow actions</CardTitle>
              <CardDescription>
                Advance the lifecycle — each action updates employee status, events, and
                notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {can("employees:write") && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result = await reissueCredentials(employee.id, true);
                      setCredentials({
                        creds: result.credentials,
                        email: result.email,
                      });
                    }, "Temporary credentials re-issued")
                  }
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Re-issue login credentials
                </Button>
              )}

              {can("employees:write") && stage === "hr_verification" && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(() => verifyEmployee(employee.id, actor), "HR verification completed")
                  }
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Complete HR verification
                </Button>
              )}

              {can("induction:assign") &&
                (Boolean(employee.verifiedAt) ||
                  stage === "hr_verification" ||
                  stage === "induction_assigned") && (
                  <div className="space-y-3 rounded-md border p-3">
                    <p className="text-sm font-medium">Assign induction modules</p>
                    {DEMO_INDUCTION_MODULES.map((m) => (
                      <div key={m.id} className="flex items-start gap-3">
                        <Checkbox
                          id={m.id}
                          checked={selectedModules.includes(m.id)}
                          onCheckedChange={() => toggleModule(m.id)}
                        />
                        <Label htmlFor={m.id} className="font-normal">
                          {m.title}
                        </Label>
                      </div>
                    ))}
                    <Button
                      disabled={busy || !selectedModules.length}
                      onClick={() =>
                        run(
                          () => assignInductionLifecycle(employee.id, selectedModules, actor),
                          "Induction assigned"
                        )
                      }
                    >
                      Assign modules
                    </Button>
                  </div>
                )}

              {can("induction:assign") && stage === "hr_verification" && !employee.verifiedAt && (
                <p className="text-sm text-muted-foreground">
                  Complete HR verification before assigning induction.
                </p>
              )}

              {can("induction:write") && stage === "induction_assigned" && (
                <Button
                  disabled={busy}
                  variant="secondary"
                  onClick={() =>
                    run(
                      () => completeInductionLifecycle(employee.id, actor),
                      "Induction marked complete"
                    )
                  }
                >
                  Mark induction completed
                </Button>
              )}

              {can("employees:handover") && stage === "induction_completed" && (
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Department handover</p>
                  <Select value={deptId} onValueChange={setHandoverDept}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_DEPARTMENTS.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={busy || !deptId}
                    onClick={() =>
                      run(
                        () => handoverLifecycle(employee.id, deptId, actor),
                        "Handover completed"
                      )
                    }
                  >
                    Complete handover
                  </Button>
                </div>
              )}

              {can("employees:write") && nxt && stage !== "qualified" && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => advanceToNext(employee.id, actor),
                      `Advanced to ${getStageDefinition(nxt).label}`
                    )
                  }
                >
                  Advance to next stage
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}

              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/jd">Open JD</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/tni">Open TNI</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/training">Training</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/exams">Exams</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/certificates">Certificates</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequirePermission>
  );
}
