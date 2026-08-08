"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { KeyRound, Loader2, ArrowRight, FileUp, ExternalLink } from "lucide-react";
import { listDepartments, departmentLabel } from "@/lib/services/departments";
import { useAuth } from "@/contexts/auth-context";
import { useEmployeeLifecycle } from "@/hooks/use-employee-lifecycle";
import { useInductionCatalog } from "@/hooks/use-induction";
import {
  advanceToNext,
  assignInductionLifecycle,
  completeInductionLifecycle,
  handoverLifecycle,
  verifyEmployee,
  type LifecycleActor,
} from "@/lib/services/lifecycle";
import { uploadSignedInductionPaper } from "@/lib/services/induction";
import { reissueCredentials, type OnboardingCredentials } from "@/lib/services/onboarding";
import { CredentialsCard } from "@/components/onboarding/credentials-card";
import { getStageDefinition, nextStage } from "@/lib/lifecycle/stages";
import { StatusBadge } from "@/components/shared/status-badge";
import { RequirePermission, RequireRole } from "@/components/auth/require-permission";
import { LifecycleStatusTracker } from "@/components/lifecycle/lifecycle-status-tracker";
import { LifecycleProgressBar } from "@/components/lifecycle/lifecycle-progress-bar";
import { LifecycleTimeline } from "@/components/lifecycle/lifecycle-timeline";
import { LifecycleActivityLog } from "@/components/lifecycle/lifecycle-activity-log";
import { LifecycleApprovals } from "@/components/lifecycle/lifecycle-approvals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { listSopsForEmployee } from "@/lib/services/sops";
import type { Department, SopDocument, UserRole } from "@/types";

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile, can } = useAuth();
  const { employee, events, approvals, loading, error, refresh } = useEmployeeLifecycle(id);
  const { modules: inductionModules } = useInductionCatalog();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [handoverDept, setHandoverDept] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignedSops, setAssignedSops] = useState<(SopDocument & { version?: unknown })[]>([]);
  const [sopsLoading, setSopsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingPaper, setUploadingPaper] = useState(false);
  const paperInputRef = useRef<HTMLInputElement>(null);
  const [credentials, setCredentials] = useState<{
    creds: OnboardingCredentials;
    email: { sent: boolean; reason?: string };
  } | null>(null);

  useEffect(() => {
    void listDepartments().then((list) => setDepartments(list.filter((d) => d.isActive)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSopsLoading(true);
    void listSopsForEmployee(id)
      .then((rows) => {
        if (!cancelled) setAssignedSops(rows);
      })
      .catch(() => {
        if (!cancelled) setAssignedSops([]);
      })
      .finally(() => {
        if (!cancelled) setSopsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, employee?.tniId, employee?.lifecycleStage]);

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

  if (error) {
    return (
      <RequirePermission permission="employees:read">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
          <p className="font-medium text-destructive">Could not load employee</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </RequirePermission>
    );
  }

  if (!employee) {
    return <p className="text-muted-foreground">Employee not found.</p>;
  }

  const stage = employee.lifecycleStage || "created";
  const stageDef = getStageDefinition(stage);
  const nxt = nextStage(stage);
  const deptId = handoverDept || employee.departmentId || departments[0]?.id || "";

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
                    departmentLabel(departments, employee.departmentId) ||
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
                <p className="text-muted-foreground">Signed induction paper</p>
                {employee.inductionSignedPaper?.downloadUrl ? (
                  <a
                    href={employee.inductionSignedPaper.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {employee.inductionSignedPaper.fileName}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="font-medium">Not uploaded</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Job Description</p>
                {employee.jdId ? (
                  <Link
                    href={`/dashboard/jd?employee=${employee.id}`}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {employee.jdId}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <p className="font-medium">Not created</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">TNI</p>
                {employee.tniId ? (
                  <Link
                    href={`/dashboard/tni?employee=${employee.id}`}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {employee.tniId}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <p className="font-medium">Not created</p>
                )}
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
              <CardTitle>Assigned SOPs</CardTitle>
              <CardDescription>
                Only SOPs linked via Training assignment or this employee&apos;s TNI — not the full
                library
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sopsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : assignedSops.length === 0 ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>No SOPs assigned yet for this employee.</p>
                  <p>
                    Add SOP links in TNI, or assign training from the Training page — then they
                    appear here and in the employee&apos;s SOP module.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/tni?employee=${employee.id}`}>Open TNI</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/training">Assign training</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {assignedSops.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">{s.sopNumber}</p>
                        <p className="truncate text-sm font-medium">{s.title}</p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/sops/${s.id}`}>
                          View
                          <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

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
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
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
                    }, employee.userId
                      ? "Temporary credentials re-issued"
                      : "Login credentials issued")
                  }
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  {employee.userId ? "Re-issue login credentials" : "Issue login credentials"}
                </Button>
              )}

              {can("employees:write") && stage === "hr_verification" && !employee.verifiedAt && (
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
                (Boolean(employee.verifiedAt) || stage === "induction_assigned") && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Assign induction modules</p>
                      <Button variant="link" size="sm" className="h-auto p-0" asChild>
                        <Link href={`/dashboard/induction?assign=${employee.id}`}>
                          Open in Induction
                        </Link>
                      </Button>
                    </div>
                    {inductionModules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No induction modules yet. Create them under Induction → Catalog → Create
                        module.
                      </p>
                    ) : (
                      inductionModules.map((m) => (
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
                      ))
                    )}
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

              {can("induction:write") &&
                (stage === "induction_assigned" ||
                  stage === "hr_verification" ||
                  Boolean(employee.verifiedAt)) &&
                stage !== "qualified" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <p className="text-sm font-medium">Signed induction paper (HR upload)</p>
                    <p className="text-xs text-muted-foreground">
                      Circulate the physical induction form to department heads for signatures,
                      then upload the signed PDF or scan here. Induction can be marked complete
                      only after upload.
                    </p>
                    {employee.inductionSignedPaper?.downloadUrl ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <a
                          href={employee.inductionSignedPaper.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          {employee.inductionSignedPaper.fileName}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <span className="text-xs text-muted-foreground">
                          Uploaded {formatDate(employee.inductionSignedPaper.uploadedAt)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Signed paper not uploaded yet.
                      </p>
                    )}
                    <Input
                      ref={paperInputRef}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      disabled={busy || uploadingPaper}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingPaper(true);
                        void uploadSignedInductionPaper({
                          employeeId: employee.id,
                          file,
                          actorId: actor.uid,
                          actorName: actor.name,
                        })
                          .then(async () => {
                            toast.success("Signed induction paper uploaded");
                            await refresh();
                          })
                          .catch((err) => {
                            toast.error(
                              err instanceof Error ? err.message : "Upload failed"
                            );
                          })
                          .finally(() => {
                            setUploadingPaper(false);
                            if (paperInputRef.current) paperInputRef.current.value = "";
                          });
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || uploadingPaper}
                      onClick={() => paperInputRef.current?.click()}
                    >
                      {uploadingPaper ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileUp className="mr-2 h-4 w-4" />
                      )}
                      {employee.inductionSignedPaper
                        ? "Replace signed paper"
                        : "Upload signed paper"}
                    </Button>
                  </div>
                )}

              {can("induction:write") && stage === "induction_assigned" && (
                <Button
                  disabled={busy || !employee.inductionSignedPaper?.downloadUrl}
                  variant="secondary"
                  onClick={() =>
                    run(
                      () => completeInductionLifecycle(employee.id, actor),
                      "Induction marked complete"
                    )
                  }
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mark induction completed
                </Button>
              )}
              {can("induction:write") &&
                stage === "induction_assigned" &&
                !employee.inductionSignedPaper?.downloadUrl && (
                  <p className="text-xs text-muted-foreground">
                    Upload the signed induction paper first to enable complete.
                  </p>
                )}

              {can("employees:handover") && stage === "induction_completed" && (
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Department handover</p>
                  <Select value={deptId} onValueChange={setHandoverDept}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
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

              <RequireRole roles="super_admin" hideOnDeny>
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
                    Advance to next stage (admin)
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </RequireRole>

              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/jd?employee=${employee.id}`}>Open JD</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/tni?employee=${employee.id}`}>Open TNI</Link>
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
