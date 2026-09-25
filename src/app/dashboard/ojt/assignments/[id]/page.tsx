"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  acknowledgeOjt,
  approveOjtByQa,
  assignOjtTrainer,
  cancelOjtAssignment,
  deleteOjtAssignment,
  deleteOjtAttachment,
  getOjtAssignment,
  getOjtSettings,
  listOjtEvaluationCriteria,
  listOjtStaffOptions,
  markRetrainingRequired,
  recordOjtExecution,
  rescheduleRetraining,
  scheduleOjtAssignment,
  startOjtExecution,
  submitOjtEvaluation,
  trainerSignOffOjt,
  uploadOjtAttachment,
  verifyOjtByHod,
} from "@/lib/services/ojt";
import { toOjtActor } from "@/lib/ojt/actor";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
import { calendarDateToIso, dateFallsInMonth, OJT_ACK_STATEMENT, monthName } from "@/lib/ojt/constants";
import { canTransition, criterionScaleForModel, displayOjtStatus, evaluationDidFail } from "@/lib/ojt/workflow";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { AdminEditButton } from "@/components/auth/admin-edit-button";
import { OjtAssignmentEditDialog } from "@/components/ojt/ojt-admin-dialogs";
import { OjtNextStepBanner, OjtProgress } from "@/components/ojt/ojt-progress";
import { ojtStatusLabel } from "@/lib/ojt/next-action";
import type { OjtAssignment, OjtCompetencyScoringModel, OjtCriterionScore, OjtEvaluationCriterion } from "@/types/ojt";

export default function OjtAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { profile } = useAuth();
  const [row, setRow] = useState<OjtAssignment | null>(null);
  const [criteria, setCriteria] = useState<OjtEvaluationCriterion[]>([]);
  const [users, setUsers] = useState<{ uid: string; displayName: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [comments, setComments] = useState("");
  const [hodComments, setHodComments] = useState("");
  const [qaComments, setQaComments] = useState("");
  const [retrainReason, setRetrainReason] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [scores, setScores] = useState<OjtCriterionScore[]>([]);
  const [scoringModel, setScoringModel] = useState<OjtCompetencyScoringModel>("both");
  const [exec, setExec] = useState({
    actualExecutionDate: "",
    startTime: "",
    endTime: "",
    location: "",
    practicalActivity: "",
    trainingDetails: "",
    observations: "",
    employeePerformance: "",
    trainerRemarks: "",
    deviationReason: "",
    sopVersionChangeJustification: "",
  });

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const needsStaff = profile?.role && profile.role !== "employee";
      const [asg, crit, staff, settings] = await Promise.all([
        getOjtAssignment(id),
        listOjtEvaluationCriteria(),
        needsStaff ? listOjtStaffOptions() : Promise.resolve([]),
        getOjtSettings(),
      ]);
      setRow(asg);
      setCriteria(crit.filter((c) => c.isActive));
      setUsers(staff);
      const model = settings.competencyScoringModel || "both";
      setScoringModel(model);
      if (asg) {
        setExec({
          actualExecutionDate: asg.actualExecutionDate?.slice(0, 10) || "",
          startTime: asg.startTime || "",
          endTime: asg.endTime || "",
          location: asg.location || "",
          practicalActivity: asg.practicalActivity || "",
          trainingDetails: asg.trainingDetails || "",
          observations: asg.observations || "",
          employeePerformance: asg.employeePerformance || "",
          trainerRemarks: asg.trainerRemarks || "",
          deviationReason: asg.executionDeviation?.reason || "",
          sopVersionChangeJustification: asg.sopVersionChangeJustification || "",
        });
        setScores(
          crit.filter((c) => c.isActive).map((c) => {
            const existing = asg.evaluation?.criteria.find((s) => s.criterionId === c.id);
            return (
              existing || {
                criterionId: c.id,
                label: c.label,
                result: "pass" as const,
                rating: criterionScaleForModel(c.ratingScale, model) === "1-5" ? 3 : undefined,
              }
            );
          })
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load OJT");
    } finally {
      setLoading(false);
    }
  }, [id, profile?.role]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh({ silent: true });
    window.addEventListener(OJT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(OJT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const actor = profile ? toOjtActor(profile) : null;
  const role = profile?.role;
  const isTrainer =
    !!profile &&
    (profile.role === "super_admin" ||
      profile.role === "qa" ||
      profile.role === "department_head" ||
      row?.trainerId === profile.uid ||
      (profile.role === "trainer" && row?.createdBy === profile.uid));
  const canSchedule = !!role && hasPermission(role, "ojt:schedule");
  const canAck =
    !!role &&
    hasPermission(role, "ojt:acknowledge") &&
    (profile?.employeeId === row?.employeeId || role === "super_admin");
  const canVerify = !!role && hasPermission(role, "ojt:verify");
  const canApprove = !!role && hasPermission(role, "ojt:approve");
  const canRetrain = !!role && hasPermission(role, "ojt:retrain");
  const canAssign = !!role && hasPermission(role, "ojt:assign");

  const trainers = useMemo(
    () => users.filter((u) => u.role === "trainer" || u.role === "department_head" || u.role === "super_admin"),
    [users]
  );

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (!actor) return;
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading OJT record…
      </div>
    );
  }
  if (!row) {
    return (
      <div className="space-y-3">
        <p>OJT assignment not found.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/ojt/assignments">Back</Link>
        </Button>
      </div>
    );
  }

  const shownStatus = displayOjtStatus(row);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground">
            <Link href="/dashboard/ojt/assignments">← Back to all records</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{row.trainingTopic}</h1>
          <p className="text-muted-foreground">
            {row.employeeName} · {row.employeeCode} · {row.departmentName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminEditButton label="Edit" size="sm" variant="outline" onClick={() => setEditing(true)} />
          <AdminDeleteButton
            label="Delete"
            size="sm"
            variant="destructive"
            confirmTitle={`Delete OJT for ${row.employeeName}?`}
            confirmDescription="This OJT record will be removed permanently. Only Super Admin can delete."
            successMessage="OJT record deleted"
            onDelete={async () => {
              if (!profile) throw new Error("Not signed in");
              await deleteOjtAssignment(row.id, toOjtActor(profile));
              router.push("/dashboard/ojt/assignments");
            }}
          />
          <StatusBadge status={shownStatus} label={ojtStatusLabel(shownStatus)} />
        </div>
      </div>

      <OjtProgress assignment={row} />
      <OjtNextStepBanner assignment={row} role={role} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Who is this for?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p><span className="text-muted-foreground">Employee:</span> {row.employeeName} ({row.employeeCode})</p>
            <p><span className="text-muted-foreground">Designation:</span> {row.designation || "—"}</p>
            <p><span className="text-muted-foreground">Department:</span> {row.departmentName || "—"}</p>
            <p><span className="text-muted-foreground">Year:</span> {row.year}</p>
            <p><span className="text-muted-foreground">Attempt:</span> {row.attemptNumber}{row.isRetraining ? " · retraining" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What is being trained?</CardTitle>
            <CardDescription>The SOP version used on the training day is kept on this record.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p><span className="text-muted-foreground">Topic:</span> {row.trainingTopic}</p>
            <p><span className="text-muted-foreground">SOP / Reference:</span> {row.sopNumber || row.referenceDocumentNumber || "NA"}</p>
            <p><span className="text-muted-foreground">SOP title:</span> {row.sopTitle || "—"}</p>
            <p><span className="text-muted-foreground">Planned SOP version:</span> {row.sopVersionNumber || "—"} {row.sopEffectiveDate ? `(eff. ${formatDate(row.sopEffectiveDate)})` : ""}</p>
            <p><span className="text-muted-foreground">Version used in training:</span> {row.trainedSopVersionNumber || row.sopVersionNumber || "—"}</p>
            {row.sopVersionChangeJustification ? (
              <p><span className="text-muted-foreground">Version change justification:</span> {row.sopVersionChangeJustification}</p>
            ) : null}
            <p><span className="text-muted-foreground">People month:</span> {monthName(row.selectionMonth)}</p>
            <p><span className="text-muted-foreground">Planned training month:</span> {monthName(row.plannedExecutionMonth)}</p>
            <p><span className="text-muted-foreground">Actual training date:</span> {formatDate(row.actualExecutionDate)}</p>
            {row.executionDeviation ? (
              <p className="rounded-md border border-amber-300/50 bg-amber-50/50 p-2 text-xs dark:bg-amber-950/20">
                Deviation from {monthName(row.executionDeviation.originalPlannedMonth)} {row.executionDeviation.originalYear}: {row.executionDeviation.reason} · {row.executionDeviation.approvedByName}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {(canAssign || canSchedule) && ["selected", "assigned", "draft"].includes(row.status) && (
        <Card id="ojt-schedule" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Pick trainer & book a date</CardTitle>
            <CardDescription>
              Prefer a date in {monthName(row.plannedExecutionMonth)} {row.year}. If the date is in another month, write a reason.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Trainer</Label>
              <Select
                value={row.trainerId || "none"}
                onValueChange={(v) => {
                  if (!actor || v === "none") return;
                  const u = trainers.find((t) => t.uid === v);
                  void run(
                    () => assignOjtTrainer(row.id, v, u?.displayName || v, actor),
                    "Trainer assigned"
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign trainer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {trainers.map((u) => (
                    <SelectItem key={u.uid} value={u.uid}>
                      {u.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canSchedule && (
              <>
                <div className="space-y-1">
                  <Label>Execution date</Label>
                  <Input
                    type="date"
                    value={exec.actualExecutionDate}
                    onChange={(e) => setExec({ ...exec, actualExecutionDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={exec.startTime}
                    onChange={(e) => setExec({ ...exec, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={exec.endTime}
                    onChange={(e) => setExec({ ...exec, endTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Location</Label>
                  <Input
                    value={exec.location}
                    onChange={(e) => setExec({ ...exec, location: e.target.value })}
                    placeholder="e.g. Dispensing room"
                  />
                </div>
                {exec.actualExecutionDate &&
                  !dateFallsInMonth(calendarDateToIso(exec.actualExecutionDate), row.year, row.plannedExecutionMonth) && (
                    <div className="space-y-1 md:col-span-2">
                      <Label>Authorized deviation reason</Label>
                      <Textarea
                        value={exec.deviationReason}
                        onChange={(e) => setExec({ ...exec, deviationReason: e.target.value })}
                        placeholder="Required when the date is outside the planned execution month"
                      />
                    </div>
                  )}
                <Button
                  disabled={busy || !row.trainerId || !exec.actualExecutionDate}
                  onClick={() => {
                    if (!actor || !row.trainerId || !exec.actualExecutionDate) return;
                    const outside = !dateFallsInMonth(
                      calendarDateToIso(exec.actualExecutionDate),
                      row.year,
                      row.plannedExecutionMonth
                    );
                    if (outside && !exec.deviationReason.trim()) {
                      toast.error("Date is outside the planned execution month. Record an authorized deviation reason.");
                      return;
                    }
                    void run(
                      () =>
                        scheduleOjtAssignment(
                          row.id,
                          {
                            executionDate: exec.actualExecutionDate,
                            startTime: exec.startTime,
                            endTime: exec.endTime,
                            location: exec.location,
                            trainerId: row.trainerId!,
                            trainerName: row.trainerName,
                            deviation: outside
                              ? {
                                  reason: exec.deviationReason,
                                  approvedBy: actor.uid,
                                  approvedByName: actor.name,
                                  approvalDate: new Date().toISOString(),
                                }
                              : undefined,
                          },
                          actor
                        ),
                      "OJT scheduled"
                    );
                  }}
                >
                  Save schedule
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {isTrainer && ["scheduled", "rescheduled", "in_progress"].includes(row.status) && (
        <Card id="ojt-execution" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Training notes</CardTitle>
            <CardDescription>Write what you showed and how the person did.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {row.status === "scheduled" || row.status === "rescheduled" ? (
              <Button
                className="md:col-span-2"
                disabled={busy}
                onClick={() => actor && run(() => startOjtExecution(row.id, actor), "OJT started")}
              >
                Start this session
              </Button>
            ) : null}
            <div className="space-y-1">
              <Label>Training date</Label>
              <Input
                type="date"
                value={exec.actualExecutionDate}
                onChange={(e) => setExec({ ...exec, actualExecutionDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input value={exec.location} onChange={(e) => setExec({ ...exec, location: e.target.value })} placeholder="Shop-floor location" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Practical activity</Label>
              <Textarea
                value={exec.practicalActivity}
                onChange={(e) => setExec({ ...exec, practicalActivity: e.target.value })}
                placeholder="What activity did you demonstrate?"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Training details / observations</Label>
              <Textarea
                value={`${exec.trainingDetails}`}
                onChange={(e) => setExec({ ...exec, trainingDetails: e.target.value })}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Employee performance</Label>
              <Textarea
                value={exec.employeePerformance}
                onChange={(e) => setExec({ ...exec, employeePerformance: e.target.value })}
              />
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                actor &&
                run(
                  () =>
                    recordOjtExecution(
                      row.id,
                      {
                        actualExecutionDate: exec.actualExecutionDate || undefined,
                        startTime: exec.startTime,
                        endTime: exec.endTime,
                        location: exec.location,
                        practicalActivity: exec.practicalActivity,
                        trainingDetails: exec.trainingDetails,
                        observations: exec.observations || exec.trainingDetails,
                        employeePerformance: exec.employeePerformance,
                        trainerRemarks: exec.trainerRemarks,
                      },
                      actor
                    ),
                  "Execution notes saved"
                )
              }
            >
              Save execution notes
            </Button>
          </CardContent>
        </Card>
      )}

      {isTrainer && ["in_progress", "scheduled", "rescheduled"].includes(row.status) && (
        <Card id="ojt-evaluation" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Score the person</CardTitle>
            <CardDescription>
              Mark each skill. A rating below 3, or any Fail, means they did not pass and need retraining.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {criteria.map((c) => {
              const score = scores.find((s) => s.criterionId === c.id);
              return (
                <div key={c.id} className="rounded-lg border p-3">
                  <p className="font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {criterionScaleForModel(c.ratingScale, scoringModel) === "1-5" ? (
                      <Select
                        value={String(score?.rating ?? 3)}
                        onValueChange={(v) =>
                          setScores((prev) =>
                            prev.map((s) =>
                              s.criterionId === c.id
                                ? {
                                    ...s,
                                    rating: Number(v),
                                    result: Number(v) < 3 ? "fail" : "pass",
                                  }
                                : s
                            )
                          )
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={score?.result || "pass"}
                        onValueChange={(v) =>
                          setScores((prev) =>
                            prev.map((s) =>
                              s.criterionId === c.id
                                ? { ...s, result: v as "pass" | "fail" | "na" }
                                : s
                            )
                          )
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pass">Pass</SelectItem>
                          <SelectItem value="fail">Fail</SelectItem>
                          <SelectItem value="na">NA</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      className="min-w-[12rem] flex-1"
                      placeholder="Comments"
                      value={score?.comments || ""}
                      onChange={(e) =>
                        setScores((prev) =>
                          prev.map((s) =>
                            s.criterionId === c.id ? { ...s, comments: e.target.value } : s
                          )
                        )
                      }
                    />
                  </div>
                </div>
              );
            })}
            <Textarea
              placeholder="Overall trainer comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => {
                  if (!actor) return;
                  const scored = scores.map((score) => {
                    const criterion = criteria.find((c) => c.id === score.criterionId);
                    const scale = criterion
                      ? criterionScaleForModel(criterion.ratingScale, scoringModel)
                      : "pass_fail";
                    return scale === "pass_fail" ? { ...score, rating: undefined } : score;
                  });
                  const failed = evaluationDidFail(scored);
                  void run(async () => {
                    if (exec.actualExecutionDate) {
                      await recordOjtExecution(
                        row.id,
                        {
                          actualExecutionDate: exec.actualExecutionDate,
                          startTime: exec.startTime,
                          endTime: exec.endTime,
                          location: exec.location,
                          practicalActivity: exec.practicalActivity,
                          trainingDetails: exec.trainingDetails,
                          observations: exec.observations || exec.trainingDetails,
                          employeePerformance: exec.employeePerformance,
                          trainerRemarks: exec.trainerRemarks,
                        },
                        actor
                      );
                    }
                    const asg = await submitOjtEvaluation(
                      row.id,
                      {
                        criteria: scored,
                        overallResult: failed ? "fail" : "pass",
                        comments,
                      },
                      actor
                    );
                    if (row.requireTrainerSignoff !== false) {
                      await trainerSignOffOjt(asg.id, comments, actor);
                    }
                  }, failed ? "Recorded as failed" : "Evaluation submitted");
                }}
              >
                {row.requireTrainerSignoff !== false ? "Save scores & sign as trainer" : "Save scores"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {row.evaluation && (
        <Card>
          <CardHeader>
            <CardTitle>Evaluation result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StatusBadge status={row.evaluation.overallResult === "pass" ? "completed" : "failed"} />
            {row.evaluation.overallRating != null ? (
              <p className="text-muted-foreground">Average rating: {row.evaluation.overallRating} / 5</p>
            ) : null}
            <p>{row.evaluation.comments}</p>
            <p className="text-muted-foreground">
              {row.evaluation.evaluatedByName} · {formatDateTime(row.evaluation.evaluatedAt)}
            </p>
          </CardContent>
        </Card>
      )}

      {canAck && row.status === "trainer_completed" && (
        <Card id="ojt-ack" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Confirm you understood</CardTitle>
            <CardDescription>Tick the box only if you can do this job the way you were trained.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{OJT_ACK_STATEMENT}</p>
            <div className="flex items-center gap-2">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} id="ack" />
              <Label htmlFor="ack">Yes, I understood this training</Label>
            </div>
            <Button
              disabled={!agreed || busy}
              onClick={() => actor && run(() => acknowledgeOjt(row.id, actor), "Acknowledgement recorded")}
            >
              Yes, I understood
            </Button>
          </CardContent>
        </Card>
      )}

      {row.acknowledgement && (
        <Card>
          <CardHeader>
            <CardTitle>Acknowledgement</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{row.acknowledgement.userName} acknowledged on {formatDateTime(row.acknowledgement.acknowledgedAt)}</p>
          </CardContent>
        </Card>
      )}

      {canVerify && row.status === "verification_pending" && (
        <Card id="ojt-hod" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>HOD check</CardTitle>
            <CardDescription>Confirm the notes are complete. Reject sends it back — it is not marked done.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={hodComments} onChange={(e) => setHodComments(e.target.value)} placeholder="Comments" />
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  actor && run(() => verifyOjtByHod(row.id, "approved", hodComments, actor), "Verified")
                }
              >
                Verify
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  if (!hodComments.trim()) {
                    toast.error("Comments are required when rejecting HOD verification");
                    return;
                  }
                  actor && run(() => verifyOjtByHod(row.id, "rejected", hodComments, actor), "Rejected");
                }}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canApprove && row.status === "qa_pending" && (
        <Card id="ojt-qa" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>QA approval</CardTitle>
            <CardDescription>Last sign-off. Approve closes this record. Reject sends it back to HOD.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={qaComments} onChange={(e) => setQaComments(e.target.value)} placeholder="Comments" />
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  actor && run(() => approveOjtByQa(row.id, "approved", qaComments, actor), "QA approved")
                }
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  if (!qaComments.trim()) {
                    toast.error("Comments are required when rejecting QA approval");
                    return;
                  }
                  actor && run(() => approveOjtByQa(row.id, "rejected", qaComments, actor), "QA rejected");
                }}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {row.hodVerification && (
        <Card>
          <CardHeader>
            <CardTitle>HOD / Designee</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {row.hodVerification.userName} · {row.hodVerification.decision} · {formatDateTime(row.hodVerification.signedAt)}
            {row.hodVerification.comments ? <p>{row.hodVerification.comments}</p> : null}
          </CardContent>
        </Card>
      )}

      {row.qaApproval && (
        <Card>
          <CardHeader>
            <CardTitle>QA approval</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {row.qaApproval.userName} · {row.qaApproval.decision} · {formatDateTime(row.qaApproval.signedAt)}
          </CardContent>
        </Card>
      )}

      {canRetrain && (row.status === "failed" || row.status === "retraining_required") && (
        <Card id="ojt-retrain" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Book retraining</CardTitle>
            <CardDescription>Old scores stay in history. A new attempt is added — nothing is deleted.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={retrainReason} onChange={(e) => setRetrainReason(e.target.value)} placeholder="Failure / retraining reason" />
            {row.status === "failed" && (
              <Button
                disabled={busy}
                onClick={() =>
                  actor &&
                  run(() => markRetrainingRequired(row.id, retrainReason || "Retraining required", actor), "Marked for retraining")
                }
              >
                Mark retraining required
              </Button>
            )}
            <div className="flex flex-wrap gap-2">
              <Input
                type="date"
                value={exec.actualExecutionDate}
                onChange={(e) => setExec({ ...exec, actualExecutionDate: e.target.value })}
              />
              <Input
                className="min-w-[240px] flex-1"
                placeholder="SOP version change justification (if current SOP changed)"
                value={exec.sopVersionChangeJustification}
                onChange={(e) => setExec({ ...exec, sopVersionChangeJustification: e.target.value })}
              />
              <Button
                disabled={busy || !exec.actualExecutionDate}
                onClick={() =>
                  actor &&
                  run(
                    () =>
                      rescheduleRetraining(
                        row.id,
                        {
                          retrainingDate: exec.actualExecutionDate,
                          sopVersionChangeJustification: exec.sopVersionChangeJustification || undefined,
                        },
                        actor
                      ),
                    "Retraining scheduled"
                  )
                }
              >
                Schedule retraining
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 text-sm">
            {(row.attachments || []).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <a className="text-primary underline" href={a.downloadUrl} target="_blank" rel="noreferrer">
                  {a.fileName}
                </a>
                {(canAssign || isTrainer) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => actor && run(() => deleteOjtAttachment(row.id, a.id, actor), "Attachment removed")}
                  >
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {(canAssign || isTrainer) && (
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file || !actor) return;
                void run(
                  () => uploadOjtAttachment({ assignmentId: row.id, file, kind: "other", actor }),
                  "Attachment uploaded"
                );
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attempt history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(row.attempts || []).length === 0 ? (
            <p className="text-muted-foreground">No completed attempts yet.</p>
          ) : (
            row.attempts.map((att) => (
              <div key={att.id} className="rounded-lg border p-3">
                Attempt {att.attemptNumber} · {att.outcome} · {formatDate(att.executionDate)}
                {att.sopVersionNumber ? ` · SOP ${att.sopVersionNumber}` : ""}
                {att.failureReason ? <p>{att.failureReason}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canAssign && canTransition(row.status, "cancelled") && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => actor && run(() => cancelOjtAssignment(row.id, actor, comments || "Cancelled"), "Cancelled")}
        >
          Cancel OJT
        </Button>
      )}

      <OjtAssignmentEditDialog
        assignment={row}
        trainers={trainers.map((u) => ({ uid: u.uid, displayName: u.displayName }))}
        open={editing}
        onOpenChange={setEditing}
        onSaved={() => refresh({ silent: true })}
      />
    </div>
  );
}
