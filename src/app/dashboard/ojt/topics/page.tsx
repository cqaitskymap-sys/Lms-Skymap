"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { useDepartments } from "@/hooks/use-departments";
import { listSopsDetailed } from "@/lib/services/sops";
import {
  createOjtTopic,
  deleteOjtTopic,
  ensureQaOjtTopicCatalog,
  getOjtSettings,
  listOjtEvaluationCriteria,
  listOjtTopics,
  updateOjtSettings,
  updateOjtTopic,
} from "@/lib/services/ojt";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { AdminEditButton } from "@/components/auth/admin-edit-button";
import { OjtTopicEditDialog } from "@/components/ojt/ojt-admin-dialogs";
import { toOjtActor } from "@/lib/ojt/actor";
import { OJT_UPDATED_EVENT } from "@/lib/ojt/demo-store";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Switch } from "@/components/ui/switch";
import { OjtEmptyState } from "@/components/ojt/ojt-empty-state";
import { OjtPageHint } from "@/components/ojt/ojt-page-hint";
import { formatDate } from "@/lib/utils";
import type { OjtEvaluationCriterion, OjtSettings, OjtTopic } from "@/types/ojt";
import type { SopDocument } from "@/types";

export default function OjtTopicsPage() {
  const { profile } = useAuth();
  const { activeDepartments } = useDepartments();
  const canWrite = profile?.role ? hasPermission(profile.role, "ojt:write") : false;
  const canAdmin = profile?.role ? hasPermission(profile.role, "ojt:admin") : false;
  const isSuperAdmin = profile?.role === "super_admin";
  const [topics, setTopics] = useState<OjtTopic[]>([]);
  const [criteria, setCriteria] = useState<OjtEvaluationCriterion[]>([]);
  const [settings, setSettings] = useState<OjtSettings | null>(null);
  const [sops, setSops] = useState<SopDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [departmentId, setDepartmentId] = useState(profile?.departmentId || "");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [sopId, setSopId] = useState("none");
  const [description, setDescription] = useState("");
  const [editingTopic, setEditingTopic] = useState<OjtTopic | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [tops, sopList, crit, cfg] = await Promise.all([
        listOjtTopics(departmentId || undefined),
        listSopsDetailed({ status: "approved" }).catch(() => [] as SopDocument[]),
        listOjtEvaluationCriteria().catch(() => [] as OjtEvaluationCriterion[]),
        getOjtSettings().catch(() => null),
      ]);
      setTopics(tops);
      setSops(sopList);
      setCriteria(crit);
      setSettings(cfg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load topics");
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh({ silent: true });
    window.addEventListener(OJT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(OJT_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  const department = useMemo(
    () => activeDepartments.find((d) => d.id === departmentId),
    [activeDepartments, departmentId]
  );

  const handleCreate = async () => {
    if (!profile || !department || !title.trim()) {
      toast.error("Department and training topic are required");
      return;
    }
    setBusy(true);
    try {
      await createOjtTopic(
        {
          trainingTopic: title.trim(),
          description: description.trim() || undefined,
          departmentId: department.id,
          departmentName: department.name,
          sopId: sopId === "none" ? undefined : sopId,
          referenceDocumentNumber: reference.trim() || (sopId === "none" ? "NA" : undefined),
        },
        toOjtActor(profile)
      );
      setTitle("");
      setDescription("");
      setReference("");
      setSopId("none");
      toast.success("OJT topic created");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSeed = async () => {
    if (!profile || !department) {
      toast.error("Select Quality Assurance (or the target department) first");
      return;
    }
    setBusy(true);
    try {
      const result = await ensureQaOjtTopicCatalog(
        { id: department.id, name: department.name },
        toOjtActor(profile)
      );
      toast.success(`Imported ${result.created} topic(s) from the QA OJT matrix (${result.linked} linked to live SOPs)`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Step 1 — Topics</h1>
        <p className="text-muted-foreground">
          Write the jobs people must learn. After this, go to Plan months.
        </p>
      </div>
      <OjtPageHint title="What to do here">
        Pick a department, type the topic name (example: Dispensing of raw materials), then click Save topic.
        Link an SOP if this training is for a procedure. You can skip SOP and write NA.
      </OjtPageHint>

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle>Add a topic</CardTitle>
            <CardDescription>
              Name the job. Link an SOP if this is for a written procedure; otherwise leave SOP as No SOP / NA.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Department</Label>
              <Select value={departmentId || undefined} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {activeDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Training topic</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dispensing of raw materials" />
            </div>
            <div className="space-y-1">
              <Label>SOP (current version)</Label>
              <Select value={sopId} onValueChange={setSopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional SOP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No SOP / NA</SelectItem>
                  {sops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.sopNumber} — {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>SOP / Reference document no.</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="SOP/QA/067 or NA"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should the trainee be able to do after this OJT?" />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button onClick={() => void handleCreate()} disabled={busy}>
                Save topic
              </Button>
              <Button variant="outline" onClick={() => void handleSeed()} disabled={busy}>
                Import QA matrix SOP list
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/dashboard/ojt/planner">Next: plan months →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Topics</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : topics.length === 0 ? (
            <OjtEmptyState
              title="No topics yet"
              description="Add the first job for this department using the form above."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Training topic</TableHead>
                  <TableHead>SOP / Reference</TableHead>
                  <TableHead>SOP title</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>SOP effective</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Created</TableHead>
                  {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.trainingTopic}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.referenceDocumentNumber || t.sopNumber || "NA"}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm">{t.sopTitle || "—"}</TableCell>
                    <TableCell>{t.sopVersionNumber || "—"}</TableCell>
                    <TableCell className="text-xs">{formatDate(t.sopEffectiveDate || t.effectiveDate)}</TableCell>
                    <TableCell>{t.departmentName || t.departmentId}</TableCell>
                    <TableCell>
                      {canWrite ? (
                        <Switch
                          checked={t.isActive}
                          onCheckedChange={(v) => {
                            if (!profile) return;
                            void updateOjtTopic(t.id, { isActive: v }, toOjtActor(profile)).catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Update failed")
                            );
                          }}
                        />
                      ) : (
                        <StatusBadge status={t.isActive ? "active" : "inactive"} />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(t.createdAt)}
                      {t.createdByName ? ` · ${t.createdByName}` : ""}
                    </TableCell>
                    {isSuperAdmin && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <AdminEditButton onClick={() => setEditingTopic(t)} />
                        <AdminDeleteButton
                          confirmTitle={`Delete ${t.trainingTopic}?`}
                          confirmDescription="This topic, related yearly plan rows, and OJT records will be removed permanently. Only Super Admin can delete."
                          successMessage="OJT topic deleted"
                          onDelete={async () => {
                            if (!profile) throw new Error("Not signed in");
                            await deleteOjtTopic(t.id, toOjtActor(profile));
                            await refresh({ silent: true });
                          }}
                        />
                      </div>
                    </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <OjtTopicEditDialog
        topic={editingTopic}
        departments={activeDepartments}
        sops={sops}
        open={!!editingTopic}
        onOpenChange={(v) => {
          if (!v) setEditingTopic(null);
        }}
        onSaved={() => refresh({ silent: true })}
      />

      {canAdmin && settings && (
        <details className="rounded-2xl border bg-card">
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
            Advanced settings — who must sign, and how scoring works
          </summary>
          <div className="grid gap-3 border-t p-6 sm:grid-cols-2">
            <p className="text-sm text-muted-foreground sm:col-span-2">
              New training records copy these flags. Leave the defaults if you are unsure.
            </p>
            {(
              [
                ["requireEmployeeAck", "Employee acknowledgement"],
                ["requireTrainerSignoff", "Trainer sign-off"],
                ["requireHodVerification", "HOD / Designee verification"],
                ["requireQaApproval", "QA approval"],
                ["allowExecutionBeforeSelection", "Allow execution month before selection month"],
                ["requireExecutionDeviationApproval", "Require authorized deviation for dates outside planned month"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                {label}
                <Switch
                  checked={Boolean(settings[key])}
                  onCheckedChange={(v) => {
                    if (!profile) return;
                    void updateOjtSettings({ [key]: v }, toOjtActor(profile))
                      .then(setSettings)
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Save failed"));
                  }}
                />
              </label>
            ))}
            <div className="space-y-1">
              <Label>Competency scoring model</Label>
              <Select
                value={settings.competencyScoringModel || "both"}
                onValueChange={(v) => {
                  if (!profile) return;
                  void updateOjtSettings(
                    { competencyScoringModel: v as OjtSettings["competencyScoringModel"] },
                    toOjtActor(profile)
                  )
                    .then(setSettings)
                    .catch((err) => toast.error(err instanceof Error ? err.message : "Save failed"));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass_fail">Pass / Fail only (official PDFs do not define 1–5)</SelectItem>
                  <SelectItem value="rating_1_5">1–5 rating (system enhancement)</SelectItem>
                  <SelectItem value="both">Pass/Fail + optional 1–5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Planner format no.</Label>
              <Input
                value={settings.plannerFormNumber}
                onBlur={() => {
                  if (!profile) return;
                  void updateOjtSettings({ plannerFormNumber: settings.plannerFormNumber }, toOjtActor(profile)).catch(
                    (err) => toast.error(err instanceof Error ? err.message : "Save failed")
                  );
                }}
                onChange={(e) => setSettings({ ...settings, plannerFormNumber: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Matrix format no.</Label>
              <Input
                value={settings.matrixFormNumber}
                onBlur={() => {
                  if (!profile) return;
                  void updateOjtSettings({ matrixFormNumber: settings.matrixFormNumber }, toOjtActor(profile)).catch(
                    (err) => toast.error(err instanceof Error ? err.message : "Save failed")
                  );
                }}
                onChange={(e) => setSettings({ ...settings, matrixFormNumber: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">Evaluation criteria</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {criteria.map((c) => (
                  <li key={c.id}>
                    {c.label} · {c.ratingScale} {c.isRequired ? "(required)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
