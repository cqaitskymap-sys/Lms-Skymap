"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
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
  updateSopDetails,
  type SopActor,
} from "@/lib/services/sops";
import { useSopReadingSession } from "@/hooks/use-sop-reading";
import { SopReadingBanner } from "@/components/sops/sop-reading-banner";
import { formatReadingClock } from "@/lib/sops/reading";
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
import { formatDate, formatDateTime, reviewDateFromEffective } from "@/lib/utils";
import type { SopDocument, SopVersion, UserRole } from "@/types";

function isoDateInput(value?: string) {
  return value ? value.slice(0, 10) : "";
}

export default function SopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, can } = useAuth();
  const searchParams = useSearchParams();
  const { departments, activeDepartments } = useDepartments();
  const { sop, versions, currentVersion, views, acknowledgements, loading, error, refresh } =
    useSopDetail(id);

  const [selected, setSelected] = useState<SopVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [reviseFiles, setReviseFiles] = useState<File[]>([]);
  const [changeSummary, setChangeSummary] = useState("");
  const [reviseVersion, setReviseVersion] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editNumber, setEditNumber] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDepts, setEditDepts] = useState<string[]>([]);
  const [editVersion, setEditVersion] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editEffective, setEditEffective] = useState("");
  const [editReview, setEditReview] = useState("");
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const editOpened = useRef(false);
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
    if (searchParams.get("edit") !== "1" || editOpened.current || !sop || !currentVersion) return;
    if (!can("sops:write")) return;
    if (currentVersion.status !== "draft" && currentVersion.status !== "under_review") return;
    editOpened.current = true;
    setEditNumber(sop.sopNumber);
    setEditTitle(sop.title);
    setEditCategory(sop.category);
    setEditDepts(sop.departmentIds);
    setEditVersion(currentVersion.versionNumber);
    setEditSummary(currentVersion.changeSummary || "");
    setEditEffective(isoDateInput(currentVersion.effectiveDate || sop.effectiveDate));
    setEditReview(isoDateInput(currentVersion.reviewDate || sop.reviewDate));
    setEditFiles([]);
    setShowEdit(true);
  }, [searchParams, sop, currentVersion, can]);

  const isEmployee = profile?.role === "employee";
  const alreadyAcked = Boolean(
    profile &&
      activeVersion &&
      acknowledgements.some((a) => a.versionId === activeVersion.id && a.userId === profile.uid)
  );
  const hasPdf = Boolean(
    activeVersion?.attachments?.some((a) => a.type === "pdf") ||
      ((!activeVersion?.attachments || activeVersion.attachments.length === 0) &&
        Boolean(activeVersion?.downloadUrl))
  );
  const enforceReading = Boolean(
    isEmployee && !alreadyAcked && activeVersion?.status === "approved"
  );
  const reading = useSopReadingSession({
    enabled: enforceReading && Boolean(sop && activeVersion && actor),
    sopId: sop?.id || id,
    versionId: activeVersion?.id || "",
    versionNumber: activeVersion?.versionNumber || "",
    userId: actor?.uid,
    hasPdf,
  });

  useEffect(() => {
    viewedOnce.current = false;
  }, [id]);

  useEffect(() => {
    if (!actor || !sop || !activeVersion || viewedOnce.current) return;
    viewedOnce.current = true;
    void recordSopView({
      sopId: sop.id,
      versionId: activeVersion.id,
      versionNumber: activeVersion.versionNumber,
      actor,
      source: "preview",
    });
  }, [sop, activeVersion, actor, refresh]);

  if (loading) return <SopLoading />;
  if (error) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-destructive">{error}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/sops">Back to SOPs</Link>
          </Button>
        </div>
      </div>
    );
  }
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
  const canEditCurrent =
    can("sops:write") &&
    activeVersion.id === sop.currentVersionId &&
    (activeVersion.status === "draft" || activeVersion.status === "under_review");
  const deptOptions = [...activeDepartments];
  for (const deptId of sop.departmentIds) {
    if (!deptOptions.some((d) => d.id === deptId)) {
      const extra = departments.find((d) => d.id === deptId);
      if (extra) deptOptions.push(extra);
    }
  }

  const fillEditForm = (source: SopDocument, version: SopVersion) => {
    setEditNumber(source.sopNumber);
    setEditTitle(source.title);
    setEditCategory(source.category);
    setEditDepts(source.departmentIds);
    setEditVersion(version.versionNumber);
    setEditSummary(version.changeSummary || "");
    setEditEffective(isoDateInput(version.effectiveDate || source.effectiveDate));
    setEditReview(isoDateInput(version.reviewDate || source.reviewDate));
    setEditFiles([]);
  };

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
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusBadge status={sop.status} />
              <span className="font-mono text-xs text-muted-foreground">
                {activeVersion.versionNumber}
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

            {canEditCurrent && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowRevise(false);
                  if (showEdit) {
                    setShowEdit(false);
                    return;
                  }
                  fillEditForm(sop, activeVersion);
                  setShowEdit(true);
                }}
              >
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Button>
            )}

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
              {activeVersion.status === "under_review" && (
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
                onClick={() => {
                  setShowRevise((open) => {
                    if (!open && activeVersion) {
                      setReviseVersion(
                        activeVersion.versionNumber.includes(".")
                          ? `${activeVersion.major}.${activeVersion.minor + 1}`
                          : String(activeVersion.major + 1)
                      );
                    }
                    return !open;
                  });
                }}
              >
                <Upload className="mr-1 h-4 w-4" />
                Upload revision
              </Button>
            </Can>
          </div>
        </div>

        {showEdit && canEditCurrent && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edit SOP</CardTitle>
              <CardDescription>
                Update details or replace the uploaded files. Approved SOPs stay locked.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>SOP number</Label>
                  <Input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Version number</Label>
                  <Input
                    value={editVersion}
                    onChange={(e) => setEditVersion(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Departments</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {deptOptions.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editDepts.includes(d.id)}
                        onCheckedChange={(c) =>
                          setEditDepts((prev) =>
                            c ? [...prev, d.id] : prev.filter((x) => x !== d.id)
                          )
                        }
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Effective date</Label>
                  <Input
                    type="date"
                    value={editEffective}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditEffective(value);
                      setEditReview(reviewDateFromEffective(value));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Review date</Label>
                  <Input
                    type="date"
                    value={editReview}
                    onChange={(e) => setEditReview(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    3 years after the effective date, one day earlier.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Change summary</Label>
                <Textarea
                  rows={2}
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Replace documents (optional)</Label>
                <SopFileDropzone files={editFiles} onChange={setEditFiles} />
                <p className="text-xs text-muted-foreground">
                  Leave this empty to keep the files already uploaded.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={busy || !editNumber.trim() || !editTitle.trim() || !editVersion.trim()}
                  onClick={() =>
                    actor &&
                    run(async () => {
                      await updateSopDetails(
                        sop.id,
                        {
                          sopNumber: editNumber,
                          title: editTitle,
                          category: editCategory,
                          departmentIds: editDepts,
                          versionNumber: editVersion,
                          changeSummary: editSummary,
                          effectiveDate: editEffective
                            ? new Date(editEffective).toISOString()
                            : undefined,
                          reviewDate: editReview
                            ? new Date(editReview).toISOString()
                            : undefined,
                          files: editFiles.length ? editFiles : undefined,
                        },
                        actor
                      );
                      setShowEdit(false);
                      setEditFiles([]);
                    }, "SOP updated")
                  }
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
                <Button variant="ghost" onClick={() => setShowEdit(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showRevise && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload revision</CardTitle>
              <CardDescription>
                Previous approved version stays effective until this revision is approved.
                On approval, affected employees are auto-reassigned training.
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
              <div className="space-y-2">
                <Label>Version number</Label>
                <Input
                  value={reviseVersion}
                  onChange={(e) => setReviseVersion(e.target.value)}
                    placeholder="2"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Proposed effective date</Label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEffectiveDate(value);
                      setReviewDate(reviewDateFromEffective(value));
                    }}
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
                  disabled={busy || !changeSummary || !reviseVersion.trim() || !reviseFiles.length}
                  onClick={() =>
                    actor &&
                    run(async () => {
                      await reviseSopWithFiles(
                        sop.id,
                        {
                          changeSummary,
                          files: reviseFiles,
                          versionNumber: reviseVersion,
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
                PDF / video / PPT for version {activeVersion.versionNumber}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {enforceReading && (
                <SopReadingBanner
                  remainingSeconds={reading.remainingSeconds}
                  requiredSeconds={reading.requiredSeconds}
                  elapsedSeconds={reading.elapsedSeconds}
                  pagesSeen={reading.pagesSeen}
                  pageCount={reading.pageCount}
                  allPagesViewed={reading.allPagesViewed}
                  timerComplete={reading.timerComplete}
                  readingComplete={reading.readingComplete}
                  hasPdf={hasPdf}
                />
              )}
              <SopMediaPreview
                version={activeVersion}
                trackReading={enforceReading}
                onPagesProgress={reading.reportPages}
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
                <Meta label="Version" value={activeVersion.versionNumber} />
                <Meta label="Category" value={sop.category} />
                <Meta label="Departments" value={deptNames || "—"} />
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
                      `Archived version ${v.versionNumber}`
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
                  {enforceReading
                    ? "Finish the reading timer and scroll every page, then confirm you have understood this SOP"
                    : "Employees confirm they have read and understood the approved SOP"}
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
                    readingRequired={enforceReading}
                    readingComplete={reading.readingComplete}
                    readingHint={
                      !reading.timerComplete && !reading.allPagesViewed
                        ? `Keep reading for ${formatReadingClock(reading.remainingSeconds)} and scroll every page before acknowledging.`
                        : !reading.timerComplete
                          ? `Keep this SOP open for ${formatReadingClock(reading.remainingSeconds)} more.`
                          : !reading.allPagesViewed
                            ? "Scroll every page of the SOP to the last page before acknowledging."
                            : undefined
                    }
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
                        {v.userEmail} · {v.versionNumber} · {v.source}
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
                  Version lifecycle on this SOP. Critical approve/submit/archive actions are also
                  written to the append-only audit trail.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {versions.map((v) => (
                  <div key={v.id} className="rounded-md border px-3 py-2">
                    <p className="font-medium">
                      {v.versionNumber} · {v.status}
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
