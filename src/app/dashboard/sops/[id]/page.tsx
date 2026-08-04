"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Send,
  Upload,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSopDetail } from "@/hooks/use-sop";
import { useDepartments } from "@/hooks/use-departments";
import {
  approveSopVersionFull,
  archiveSopVersion,
  recordSopView,
  reviseSopWithFiles,
  submitSopForReview,
  type SopActor,
} from "@/lib/services/sops";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import { StatusBadge } from "@/components/shared/status-badge";
import { SopMediaPreview, SopFileDropzone, SopLoading, ViewerBadge } from "@/components/sops/sop-media-preview";
import { SopVersionHistory } from "@/components/sops/sop-version-history";
import { SopAcknowledgementPanel } from "@/components/sops/sop-acknowledgement";
import { AiExplainSopPanel } from "@/components/ai/ai-explain-sop-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { SopVersion, UserRole } from "@/types";

export default function SopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, can } = useAuth();
  const { departments } = useDepartments();
  const { sop, versions, currentVersion, views, acknowledgements, loading, refresh } =
    useSopDetail(id);

  const [selected, setSelected] = useState<SopVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [reviseFiles, setReviseFiles] = useState<File[]>([]);
  const [changeSummary, setChangeSummary] = useState("");
  const [majorBump, setMajorBump] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const viewedOnce = useRef(false);

  const actor: SopActor | null = useMemo(() => {
    if (!profile) return null;
    return {
      uid: profile.uid,
      name: profile.displayName,
      email: profile.email,
      role: profile.role as UserRole,
      employeeId: profile.employeeId,
    };
  }, [profile]);

  useEffect(() => {
    if (currentVersion) setSelected(currentVersion);
  }, [currentVersion]);

  const activeVersion = selected || currentVersion;

  useEffect(() => {
    if (!actor || !sop || !activeVersion || viewedOnce.current) return;
    viewedOnce.current = true;
    void recordSopView({
      sopId: sop.id,
      versionId: activeVersion.id,
      versionNumber: activeVersion.versionNumber,
      actor,
      source: "preview",
    }).then(() => refresh());
  }, [sop, activeVersion, actor, refresh]);

  if (loading) return <SopLoading />;
  if (!sop || !activeVersion) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">SOP not found.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/sops">Back to SOPs</Link>
        </Button>
      </div>
    );
  }

  const deptNames = sop.departmentIds
    .map((d) => departments.find((x) => x.id === d)?.name || d)
    .join(", ");

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

  return (
    <RequirePermission permission="sops:read">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" className="-ml-2 mb-1" asChild>
              <Link href="/dashboard/sops">
                <ArrowLeft className="mr-1 h-4 w-4" />
                All SOPs
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {sop.sopNumber} — {sop.title}
            </h1>
            <p className="max-w-2xl text-muted-foreground">{sop.description}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusBadge status={sop.status} />
              <span className="font-mono text-xs text-muted-foreground">
                v{activeVersion.versionNumber}
              </span>
              <ViewerBadge count={sop.viewCount || 0} />
              <span className="text-xs text-muted-foreground">
                {sop.acknowledgementCount || 0} acknowledgements
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (actor) {
                  void recordSopView({
                    sopId: sop.id,
                    versionId: activeVersion.id,
                    versionNumber: activeVersion.versionNumber,
                    actor,
                    source: "download",
                  });
                }
                window.open(activeVersion.downloadUrl, "_blank");
              }}
            >
              <Download className="mr-1 h-4 w-4" />
              Download
            </Button>

            <Can permission="sops:write">
              {(activeVersion.status === "draft" || activeVersion.status === "under_review") && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || activeVersion.status === "under_review"}
                  onClick={() =>
                    actor &&
                    run(
                      () => submitSopForReview(sop.id, activeVersion.id, actor),
                      "Submitted for QA review"
                    )
                  }
                >
                  <Send className="mr-1 h-4 w-4" />
                  Submit for review
                </Button>
              )}
            </Can>

            <Can permission="sops:approve">
              {(activeVersion.status === "under_review" ||
                activeVersion.status === "draft") && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    actor &&
                    run(async () => {
                      const result = await approveSopVersionFull(
                        sop.id,
                        activeVersion.id,
                        actor,
                        {
                          effectiveDate: effectiveDate
                            ? new Date(effectiveDate).toISOString()
                            : undefined,
                          reviewDate: reviewDate
                            ? new Date(reviewDate).toISOString()
                            : undefined,
                          triggerRetrain: true,
                        }
                      );
                      if (result.retrainCount > 0) {
                        toast.message(
                          `Auto-assigned retraining to ${result.retrainCount} employee(s)`
                        );
                      }
                    }, "SOP approved")
                  }
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Approve
                </Button>
              )}
            </Can>

            <Can permission="sops:write">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRevise((v) => !v)}
              >
                <Upload className="mr-1 h-4 w-4" />
                Upload revision
              </Button>
            </Can>
          </div>
        </div>

        {showRevise && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload revision</CardTitle>
              <CardDescription>
                Archives previous current version. On approval, affected employees are
                auto-reassigned training.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Change summary</Label>
                <Textarea
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Describe what changed…"
                  rows={2}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={majorBump}
                  onCheckedChange={(c) => setMajorBump(Boolean(c))}
                />
                Major version bump (e.g. 1.2 → 2.0)
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Proposed effective date</Label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Next review date</Label>
                  <Input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                  />
                </div>
              </div>
              <SopFileDropzone files={reviseFiles} onChange={setReviseFiles} />
              <div className="flex gap-2">
                <Button
                  disabled={busy || !changeSummary || !reviseFiles.length}
                  onClick={() =>
                    actor &&
                    run(async () => {
                      await reviseSopWithFiles(
                        sop.id,
                        {
                          changeSummary,
                          files: reviseFiles,
                          majorBump,
                          effectiveDate: effectiveDate
                            ? new Date(effectiveDate).toISOString()
                            : undefined,
                          reviewDate: reviewDate
                            ? new Date(reviewDate).toISOString()
                            : undefined,
                        },
                        actor
                      );
                      setShowRevise(false);
                      setReviseFiles([]);
                      setChangeSummary("");
                    }, "Revision uploaded as draft")
                  }
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save revision draft
                </Button>
                <Button variant="ghost" onClick={() => setShowRevise(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Document preview</CardTitle>
              <CardDescription>
                PDF / video / PPT for v{activeVersion.versionNumber}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SopMediaPreview
                version={activeVersion}
                onDownload={(att) => {
                  if (!actor) return;
                  void recordSopView({
                    sopId: sop.id,
                    versionId: activeVersion.id,
                    versionNumber: activeVersion.versionNumber,
                    actor,
                    source: "download",
                  });
                  toast.message(`Download logged · ${att.fileName}`);
                }}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Meta label="Category" value={sop.category} />
                <Meta label="Departments" value={deptNames || "—"} />
                <Meta label="Tags" value={sop.tags.join(", ") || "—"} />
                <Meta label="Effective date" value={formatDate(sop.effectiveDate || activeVersion.effectiveDate)} />
                <Meta label="Review date" value={formatDate(sop.reviewDate || activeVersion.reviewDate)} />
                <Meta
                  label="Approved by"
                  value={
                    activeVersion.approvedByName
                      ? `${activeVersion.approvedByName} · ${formatDateTime(activeVersion.approvedAt)}`
                      : "—"
                  }
                />
                <Meta label="Change summary" value={activeVersion.changeSummary} />
              </CardContent>
            </Card>

            <AiExplainSopPanel
              title={`${sop.sopNumber} — ${sop.title}`}
              description={sop.description}
              changeSummary={activeVersion.changeSummary}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Version control</CardTitle>
                <CardDescription>Revision history · archive old versions</CardDescription>
              </CardHeader>
              <CardContent>
                <SopVersionHistory
                  versions={versions}
                  currentVersionId={sop.currentVersionId}
                  selectedId={activeVersion.id}
                  onSelect={setSelected}
                  canArchive={can("sops:approve")}
                  onArchive={(v) =>
                    actor &&
                    run(
                      () =>
                        archiveSopVersion(v.id, "Archived from SOP detail", actor),
                      `Archived v${v.versionNumber}`
                    )
                  }
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="acknowledge">
          <TabsList>
            <TabsTrigger value="acknowledge">Acknowledgement</TabsTrigger>
            <TabsTrigger value="views">Who viewed</TabsTrigger>
            <TabsTrigger value="audit">Audit trail</TabsTrigger>
          </TabsList>

          <TabsContent value="acknowledge" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Digital acknowledgement</CardTitle>
                <CardDescription>
                  Employees confirm they have read and understood the approved SOP
                </CardDescription>
              </CardHeader>
              <CardContent>
                {actor && (
                  <SopAcknowledgementPanel
                    sopId={sop.id}
                    version={activeVersion}
                    actor={actor}
                    acknowledgements={acknowledgements.filter(
                      (a) => a.versionId === activeVersion.id
                    )}
                    onDone={() => void refresh()}
                    canAcknowledge={Boolean(profile)}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="views" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">View tracking</CardTitle>
                <CardDescription>Preview and download events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {views.length === 0 && (
                  <p className="text-sm text-muted-foreground">No views recorded yet.</p>
                )}
                {views.slice(0, 30).map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{v.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.userEmail} · v{v.versionNumber} · {v.source}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(v.viewedAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lifecycle audit</CardTitle>
                <CardDescription>
                  Creates, revisions, approvals, acknowledgements, and retraining are
                  logged to the audit trail
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {versions.map((v) => (
                  <div key={v.id} className="rounded-md border px-3 py-2">
                    <p className="font-medium">
                      v{v.versionNumber} · {v.status}
                    </p>
                    <p className="text-xs text-muted-foreground">{v.changeSummary}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDateTime(v.createdAt)}
                      {v.submittedForReviewAt
                        ? ` · Submitted ${formatDateTime(v.submittedForReviewAt)}`
                        : ""}
                      {v.approvedAt
                        ? ` · Approved ${formatDateTime(v.approvedAt)}`
                        : ""}
                      {v.retrainAssignedCount
                        ? ` · Retrain ×${v.retrainAssignedCount}`
                        : ""}
                    </p>
                  </div>
                ))}
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/audit">Open full audit log</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RequirePermission>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
