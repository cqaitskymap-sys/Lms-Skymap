"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { UserProfile, UserRole } from "@/types";
import type { OjtFormApprovalConfig, OjtFormDocument, OjtFormKind, OjtFormSignoffRole } from "@/types/ojt";
import {
  DEFAULT_OJT_FORM_APPROVALS,
  OJT_FORM_SIGNOFF_LABELS,
  PLANNER_FORM_APPROVALS,
  formatOfficialDate,
  formatRevisionNumber,
} from "@/lib/ojt/constants";
import { canSignFormRole, formApprovalsFor, formAssignee, latestSignoff, requiredRolesForApproval } from "@/lib/ojt/forms";
import {
  assignOjtFormApprover,
  createOjtFormRevision,
  getOjtSettings,
  signOjtFormDocument,
  updateOjtFormDocumentMeta,
} from "@/lib/services/ojt";
import { listUsersByRoles } from "@/lib/services/users";
import { ROLE_LABELS } from "@/lib/rbac/permissions";
import { toOjtActor } from "@/lib/ojt/actor";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function eligibleRoles(role: OjtFormSignoffRole): UserRole[] {
  if (role === "approved_by_qa") return ["qa", "super_admin"];
  return ["department_head", "qa", "super_admin"];
}

function signAction(role: OjtFormSignoffRole): "prepared" | "checked" | "verified" | "approved" {
  if (role === "prepared_by") return "prepared";
  if (role === "approved_by_qa") return "approved";
  if (role === "verified_by_hod") return "verified";
  return "checked";
}

export function OjtFormApprovalPanel({
  kind,
  year,
  departmentId,
  departmentName,
  form,
  onChanged,
}: {
  kind: OjtFormKind;
  year: number;
  departmentId: string;
  departmentName?: string;
  form: OjtFormDocument | null;
  onChanged: () => Promise<void> | void;
}) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(form?.effectiveDate?.slice(0, 10) || "");
  const [revisionReason, setRevisionReason] = useState("");
  const [approvalConfig, setApprovalConfig] = useState<OjtFormApprovalConfig | null>(null);
  const [staff, setStaff] = useState<UserProfile[]>([]);

  useEffect(() => {
    setEffectiveDate(form?.effectiveDate?.slice(0, 10) || "");
  }, [form?.id, form?.effectiveDate, form?.revisionNumber]);

  useEffect(() => {
    let cancelled = false;
    void getOjtSettings()
      .then((settings) => {
        if (!cancelled) setApprovalConfig(formApprovalsFor(kind, settings));
      })
      .catch(() => {
        if (!cancelled) setApprovalConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  useEffect(() => {
    let cancelled = false;
    void listUsersByRoles(["super_admin", "qa", "department_head"])
      .then((rows) => {
        if (!cancelled) setStaff(rows);
      })
      .catch(() => {
        if (!cancelled) setStaff([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canWrite = profile?.role ? hasPermission(profile.role, "ojt:write") : false;
  const title = kind === "planner" ? "Approve the yearly plan" : "Approve the people list";
  const signoffOrder = requiredRolesForApproval(
    approvalConfig || (kind === "planner" ? PLANNER_FORM_APPROVALS : DEFAULT_OJT_FORM_APPROVALS)
  );

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setComment("");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              Choose the person for each block. That person gets the request when it is their turn, and their electronic signature is what prints.
            </CardDescription>
          </div>
          <StatusBadge status={form?.status || "draft"} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Effective Date</Label>
            <Input
              type="date"
              value={effectiveDate}
              disabled={!canWrite || form?.locked}
              onChange={(e) => setEffectiveDate(e.target.value)}
              onBlur={() => {
                if (!profile || !departmentId || form?.locked) return;
                const saved = form?.effectiveDate?.slice(0, 10) || "";
                if (!effectiveDate) {
                  setEffectiveDate(saved);
                  if (saved) toast.error("Effective date is required");
                  return;
                }
                if (effectiveDate === saved) return;
                void run(
                  () =>
                    updateOjtFormDocumentMeta(
                      kind,
                      year,
                      departmentId,
                      { effectiveDate, departmentName },
                      toOjtActor(profile)
                    ),
                  "Effective date saved"
                );
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Revision No.</Label>
            <Input value={formatRevisionNumber(form?.revisionNumber || "00")} readOnly />
          </div>
          <div className="space-y-1">
            <Label>Format No.</Label>
            <Input value={form?.formNumber || "—"} readOnly />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {signoffOrder.map((role) => {
            const latest = form ? latestSignoff(form, role) : undefined;
            const signed = latest && latest.action !== "rejected" ? latest : undefined;
            const rejected = latest?.action === "rejected" ? latest : undefined;
            const labels = OJT_FORM_SIGNOFF_LABELS[role];
            const action = signAction(role);
            const assignee = form ? formAssignee(form, role) : undefined;
            const priorReady =
              !approvalConfig || !form || canSignFormRole(form, approvalConfig, role);
            const allowed = new Set(eligibleRoles(role));
            const choices = staff.filter((user) => allowed.has(user.role));
            const known = assignee && choices.some((user) => user.uid === assignee.userId);
            const isAssignee =
              Boolean(assignee && profile && (assignee.userId === profile.uid || profile.role === "super_admin"));
            return (
              <div key={role} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{labels.title}</p>
                <p className="text-muted-foreground">{labels.subtitle}</p>
                {!signed && (
                  <div className="mt-2 space-y-1">
                    <Label className="text-xs">Who approves</Label>
                    <Select
                      value={assignee?.userId || undefined}
                      disabled={!canWrite || Boolean(form?.locked) || busy || !departmentId}
                      onValueChange={(userId) => {
                        const person = choices.find((user) => user.uid === userId);
                        const name = person?.displayName || (assignee?.userId === userId ? assignee.userName : "");
                        if (!name || !profile) return;
                        const message = priorReady
                          ? name === profile.displayName
                            ? "You can add your electronic signature"
                            : `Sent to ${name} for electronic signature`
                          : `${name} will be asked after the previous signature`;
                        void run(
                          () =>
                            assignOjtFormApprover({
                              kind,
                              year,
                              departmentId,
                              departmentName,
                              role,
                              userId,
                              userName: name,
                              actor: toOjtActor(profile),
                            }),
                          message
                        );
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select who will approve" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignee && !known && (
                          <SelectItem value={assignee.userId}>{assignee.userName}</SelectItem>
                        )}
                        {choices.map((user) => (
                          <SelectItem key={user.uid} value={user.uid}>
                            {user.displayName || user.email} · {ROLE_LABELS[user.role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {signed ? (
                  <div className="mt-2">
                    <p className="text-base leading-tight text-sky-800" style={{ fontFamily: '"Segoe Script", "Lucida Handwriting", cursive' }}>
                      {signed.userName}
                    </p>
                    <p className="text-[10px] italic text-muted-foreground">
                      Electronically computer-generated signature
                    </p>
                    <p className="text-xs">{formatOfficialDate(signed.timestamp)}</p>
                  </div>
                ) : rejected ? (
                  <p className="mt-2 text-xs text-destructive">
                    Rejected by {rejected.userName} · {formatOfficialDate(rejected.timestamp)}
                  </p>
                ) : assignee ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {priorReady
                      ? `Waiting for ${assignee.userName} to sign`
                      : `${assignee.userName} will be asked after the previous signature`}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Select who will approve</p>
                )}
                {isAssignee && !form?.locked && !signed && priorReady && (
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={busy || !departmentId}
                    onClick={() =>
                      profile &&
                      run(
                        () =>
                          signOjtFormDocument({
                            kind,
                            year,
                            departmentId,
                            departmentName,
                            role,
                            action,
                            comment,
                            actor: toOjtActor(profile),
                          }),
                        "Electronically computer-generated signature added"
                      )
                    }
                  >
                    {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Add electronic signature
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-1">
          <Label>Comment (required for reject / revision)</Label>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment" />
        </div>

        {form?.locked ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1 space-y-1">
              <Label>Revision reason</Label>
              <Input
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="Why is a new revision required?"
              />
            </div>
            <Button
              variant="outline"
              disabled={busy || !revisionReason.trim() || !canWrite}
              onClick={() =>
                profile &&
                run(
                  () =>
                    createOjtFormRevision({
                      kind,
                      year,
                      departmentId,
                      reason: revisionReason,
                      actor: toOjtActor(profile),
                    }),
                  "New revision opened"
                )
              }
            >
              Create revision
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            After QA approval this {kind} is controlled. Further changes require a new revision number.
          </p>
        )}

        {(form?.revisions || []).length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Revision history</p>
            <ul className="space-y-1">
              {form!.revisions.map((rev) => (
                <li key={`${rev.revisionNumber}-${rev.createdAt}`}>
                  Rev. {rev.revisionNumber} · {formatOfficialDate(rev.effectiveDate)} · {rev.createdByName} — {rev.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
