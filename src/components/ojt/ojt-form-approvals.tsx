"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@/types";
import type { OjtFormDocument, OjtFormKind, OjtFormSignoffRole } from "@/types/ojt";
import { OJT_FORM_SIGNOFF_LABELS, formatOfficialDate, formatRevisionNumber } from "@/lib/ojt/constants";
import { latestSignoff } from "@/lib/ojt/forms";
import {
  createOjtFormRevision,
  signOjtFormDocument,
  updateOjtFormDocumentMeta,
} from "@/lib/services/ojt";
import { toOjtActor } from "@/lib/ojt/actor";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";

const SIGNOFF_ORDER: OjtFormSignoffRole[] = [
  "prepared_by",
  "checked_by_head",
  "approved_by_qa",
];

function canSignRole(role: OjtFormSignoffRole, userRole?: UserRole | null): boolean {
  if (!userRole) return false;
  if (userRole === "super_admin") return true;
  if (role === "approved_by_qa") return userRole === "qa";
  if (role === "checked_by_head") {
    return userRole === "department_head" || userRole === "qa";
  }
  return hasPermission(userRole, "ojt:write");
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

  useEffect(() => {
    setEffectiveDate(form?.effectiveDate?.slice(0, 10) || "");
  }, [form?.id, form?.effectiveDate, form?.revisionNumber]);

  const canWrite = profile?.role ? hasPermission(profile.role, "ojt:write") : false;
  const title = kind === "planner" ? "Sign the yearly plan" : "Sign the people list";

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
              When this page is ready, sign in order: Prepare → HOD check → QA approve.
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
              value={effectiveDate || form?.effectiveDate?.slice(0, 10) || ""}
              disabled={!canWrite || form?.locked}
              onChange={(e) => setEffectiveDate(e.target.value)}
              onBlur={() => {
                if (!profile || !departmentId || !effectiveDate || form?.locked) return;
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
          {SIGNOFF_ORDER.map((role) => {
            const signed = form ? latestSignoff(form, role) : undefined;
            const labels = OJT_FORM_SIGNOFF_LABELS[role];
            const action =
              role === "prepared_by" ? "prepared" : role === "approved_by_qa" ? "approved" : "checked";
            return (
              <div key={role} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{labels.title}</p>
                <p className="text-muted-foreground">{labels.subtitle}</p>
                {signed ? (
                  <p className="mt-2 text-xs">
                    {signed.userName} · {formatOfficialDate(signed.timestamp)}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Sign & Date pending</p>
                )}
                {canSignRole(role, profile?.role) && !form?.locked && !signed && (
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
                        `${labels.title} recorded`
                      )
                    }
                  >
                    {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Sign as {labels.subtitle}
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
