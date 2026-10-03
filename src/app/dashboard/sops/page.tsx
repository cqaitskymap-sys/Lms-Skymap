"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, FileText, Eye, PenLine, Layers, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataToolbar } from "@/components/shared/data-toolbar";
import {
  SopBulkApproveDialog,
  SopSendForApprovalDialog,
} from "@/components/sops/sop-approval-dialogs";
import { useAuth } from "@/contexts/auth-context";
import { useSopDirectory } from "@/hooks/use-sop";
import { useDepartments } from "@/hooks/use-departments";
import { bulkApproveSops, bulkSubmitSopsForReview, deleteSop, type SopBulkTarget } from "@/lib/services/sops";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { SopLoading } from "@/components/sops/sop-media-preview";
import type { SopDocument, SopVersion } from "@/types";

type SopRow = SopDocument & { version?: SopVersion };

function approverIdOf(sop: SopRow) {
  return sop.assignedApproverId || sop.version?.assignedApproverId || "";
}

function approverNameOf(sop: SopRow) {
  return sop.assignedApproverName || sop.version?.assignedApproverName || "";
}

function toTarget(sop: SopRow): SopBulkTarget {
  return {
    sopId: sop.id,
    versionId: sop.currentVersionId || sop.version?.id || "",
    sopNumber: sop.sopNumber,
    effectiveDate: sop.effectiveDate || sop.version?.effectiveDate,
    reviewDate: sop.reviewDate || sop.version?.reviewDate,
  };
}

export default function SopsPage() {
  const { profile, can } = useAuth();
  const isEmployee = profile?.role === "employee";
  const canWrite = can("sops:write");
  const canApprove = can("sops:approve");
  const canBulk = !isEmployee && (canWrite || canApprove);
  const { sops, loading, error, refresh } = useSopDirectory();
  const { departments } = useDepartments();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendOpen, setSendOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [approveTargets, setApproveTargets] = useState<SopRow[]>([]);

  const mine = useMemo(
    () => sops.filter((sop) => sop.status === "under_review" && approverIdOf(sop) === profile?.uid),
    [sops, profile?.uid]
  );

  const filtered = useMemo(() => {
    return sops.filter((s) => {
      const matchSearch =
        !search ||
        `${s.sopNumber} ${s.title} ${s.category} ${(s.tags || []).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchStatus = !status || s.status === status;
      const matchMine = !mineOnly || (s.status === "under_review" && approverIdOf(s) === profile?.uid);
      return matchSearch && matchStatus && matchMine;
    });
  }, [sops, search, status, mineOnly, profile?.uid]);

  const selectable = useMemo(
    () => filtered.filter((sop) => sop.status === "draft" || sop.status === "under_review"),
    [filtered]
  );
  const selectedRows = useMemo(
    () => sops.filter((sop) => selected.has(sop.id)),
    [sops, selected]
  );
  const sendTargets = selectedRows.filter(
    (sop) =>
      canWrite &&
      (sop.status === "draft" || sop.status === "under_review") &&
      Boolean(sop.currentVersionId || sop.version?.id)
  );
  const readyToApprove = selectedRows.filter(
    (sop) =>
      canApprove &&
      sop.status === "under_review" &&
      (!approverIdOf(sop) || approverIdOf(sop) === profile?.uid)
  );
  const allSelected = selectable.length > 0 && selectable.every((sop) => selected.has(sop.id));
  const someSelected = selectable.some((sop) => selected.has(sop.id));

  useEffect(() => {
    const ids = new Set(sops.map((sop) => sop.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sops]);

  const deptLabel = (ids: string[]) =>
    ids
      .map((id) => departments.find((d) => d.id === id)?.code || id)
      .join(", ");

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const sop of selectable) next.delete(sop.id);
      } else {
        for (const sop of selectable) next.add(sop.id);
      }
      return next;
    });
  };

  const toggleOne = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectMine = () => {
    setMineOnly(true);
    setStatus("under_review");
    setSelected(new Set(mine.map((sop) => sop.id)));
  };

  const finishBulk = async (ok: string, failed: string[], succeeded: number) => {
    if (failed.length) toast.error(failed.slice(0, 3).join(" · "));
    if (ok) toast.success(ok);
    if (succeeded > 0) {
      setSelected(new Set());
      setSendOpen(false);
      setApproveOpen(false);
    }
    await refresh();
  };

  const sendForApproval = async (approver: { uid: string; name: string }) => {
    if (!profile || sendTargets.length === 0) return;
    setBusy(true);
    setProgress(null);
    try {
      const result = await bulkSubmitSopsForReview(
        sendTargets.map(toTarget),
        {
          uid: profile.uid,
          name: profile.displayName,
          email: profile.email,
          role: profile.role,
          employeeId: profile.employeeId,
        },
        approver,
        (done, total) => setProgress(`Sending ${done} of ${total}…`)
      );
      await finishBulk(
        result.done
          ? `Sent ${result.done} SOP${result.done === 1 ? "" : "s"} to ${approver.name}`
          : "",
        result.failed,
        result.done
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send SOPs");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const approveSelected = async () => {
    if (!profile || approveTargets.length === 0) return;
    setBusy(true);
    setProgress(null);
    try {
      const result = await bulkApproveSops(
        approveTargets.map(toTarget),
        {
          uid: profile.uid,
          name: profile.displayName,
          email: profile.email,
          role: profile.role,
          employeeId: profile.employeeId,
        },
        (done, total) => setProgress(`Approving ${done} of ${total}…`)
      );
      const retrain =
        result.retrainCount > 0 ? ` · retraining assigned to ${result.retrainCount}` : "";
      await finishBulk(
        result.done ? `Approved ${result.done} SOP${result.done === 1 ? "" : "s"}${retrain}` : "",
        result.failed,
        result.done
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve SOPs");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (loading) return <SopLoading />;

  if (error) {
    return (
      <RequirePermission permission={["sops:read"]}>
        <div className="py-16 text-center">
          <p className="text-destructive">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission permission={["sops:read"]}>
      <div className="space-y-6 pb-24">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEmployee ? "My SOPs" : "SOP Management"}
            </h1>
            <p className="text-muted-foreground">
              {isEmployee
                ? "SOPs from your TNI — acknowledge a SOP, then take its exam"
                : "Controlled documents · versioning · acknowledgement · auto-retraining"}
            </p>
          </div>
          <RequirePermission permission="sops:write" hideOnDeny>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/dashboard/sops/new/bulk">
                  <Layers className="mr-2 h-4 w-4" />
                  Bulk entry
                </Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard/sops/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New SOP
                </Link>
              </Button>
            </div>
          </RequirePermission>
        </div>

        {canApprove && mine.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm">
              <span className="font-semibold">{mine.length}</span> SOP
              {mine.length === 1 ? "" : "s"} waiting for your approval.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={selectMine}>
                Select them
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setApproveTargets(mine);
                  setApproveOpen(true);
                }}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve all
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total SOPs", value: sops.length, icon: FileText },
            {
              label: "Approved",
              value: sops.filter((s) => s.status === "approved").length,
              icon: FileText,
            },
            {
              label: "Under review",
              value: sops.filter((s) => s.status === "under_review").length,
              icon: Eye,
            },
            {
              label: "Acknowledgements",
              value: sops.reduce((n, s) => n + (s.acknowledgementCount || 0), 0),
              icon: PenLine,
            },
          ].map((c) => (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <c.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <DataToolbar
          searchPlaceholder="Search SOPs…"
          searchValue={search}
          onSearch={setSearch}
          filters={[
            {
              key: "status",
              label: "Status",
              value: status,
              options: [
                { label: "Draft", value: "draft" },
                { label: "Under review", value: "under_review" },
                { label: "Approved", value: "approved" },
                { label: "Obsolete", value: "obsolete" },
              ],
            },
          ]}
          onFilterChange={(key, value) => {
            if (key === "status") setStatus(value);
          }}
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">{filtered.length} documents</CardTitle>
            <div className="flex flex-wrap gap-2">
              {canBulk && selectable.length > 0 && (
                <Button size="sm" variant="outline" onClick={toggleAll}>
                  {allSelected ? "Clear selection" : `Select all (${selectable.length})`}
                </Button>
              )}
              {canApprove && (
                <Button
                  size="sm"
                  variant={mineOnly ? "default" : "outline"}
                  onClick={() => setMineOnly((on) => !on)}
                >
                  Waiting for me{mine.length ? ` (${mine.length})` : ""}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {canBulk && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                        disabled={selectable.length === 0}
                        aria-label="Select all SOPs"
                      />
                    </TableHead>
                  )}
                  <TableHead>SOP No.</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Departments</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Views / Ack</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canBulk ? 10 : 9} className="py-12 text-center text-muted-foreground">
                      {sops.length === 0 ? (
                        <div className="space-y-2">
                          <p>
                            {isEmployee
                              ? "No SOPs from your TNI yet. They appear after the department adds SOPs to your TNI."
                              : "No SOPs in the library yet."}
                          </p>
                          {!isEmployee && (
                            <RequirePermission permission="sops:write" hideOnDeny>
                              <div className="flex flex-wrap justify-center gap-2">
                                <Button size="sm" variant="outline" asChild>
                                  <Link href="/dashboard/sops/new/bulk">Bulk entry</Link>
                                </Button>
                                <Button size="sm" asChild>
                                  <Link href="/dashboard/sops/new">Create first SOP</Link>
                                </Button>
                              </div>
                            </RequirePermission>
                          )}
                        </div>
                      ) : (
                        "No SOPs match your filters."
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => {
                    const canSelect = s.status === "draft" || s.status === "under_review";
                    const approverName = approverNameOf(s);
                    return (
                  <TableRow key={s.id} data-state={selected.has(s.id) ? "selected" : undefined}>
                    {canBulk && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(s.id)}
                          disabled={!canSelect}
                          onCheckedChange={(value) => toggleOne(s.id, value === true)}
                          aria-label={`Select ${s.sopNumber}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Link
                        href={`/dashboard/sops/${s.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {s.sopNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.category}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {s.currentVersionNumber || s.version?.versionNumber || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{deptLabel(s.departmentIds)}</TableCell>
                    <TableCell>{formatDate(s.effectiveDate)}</TableCell>
                    <TableCell>{formatDate(s.reviewDate)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.viewCount || 0} / {s.acknowledgementCount || 0}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                      {s.status === "under_review" && approverName && (
                        <p className="mt-1 text-[11px] text-muted-foreground">For {approverName}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {(s.status === "draft" || s.status === "under_review") && (
                          <RequirePermission permission="sops:write" hideOnDeny>
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/dashboard/sops/${s.id}?edit=1`}>Edit</Link>
                            </Button>
                          </RequirePermission>
                        )}
                        <AdminDeleteButton
                          confirmTitle={`Delete ${s.sopNumber}?`}
                          confirmDescription="This SOP and its versions, views, and acknowledgements will be removed permanently."
                          successMessage="SOP deleted"
                          onDelete={async () => {
                            await deleteSop(s.id);
                            await refresh();
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {canBulk && selected.size > 0 && (
          <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 lg:pl-64">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border bg-background px-4 py-3 shadow-lift">
              <p className="mr-1 text-sm font-medium">{selected.size} selected</p>
              {canWrite && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || sendTargets.length === 0}
                  onClick={() => setSendOpen(true)}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send for approval{sendTargets.length ? ` (${sendTargets.length})` : ""}
                </Button>
              )}
              {canApprove && (
                <Button
                  size="sm"
                  disabled={busy || readyToApprove.length === 0}
                  onClick={() => {
                    setApproveTargets(readyToApprove);
                    setApproveOpen(true);
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve selected{readyToApprove.length ? ` (${readyToApprove.length})` : ""}
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        )}

        <SopSendForApprovalDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          sopCount={sendTargets.length}
          busy={busy}
          progressLabel={progress}
          onConfirm={(approver) => void sendForApproval(approver)}
        />
        <SopBulkApproveDialog
          open={approveOpen}
          onOpenChange={setApproveOpen}
          sopNumbers={approveTargets.map((sop) => sop.sopNumber)}
          busy={busy}
          progressLabel={progress}
          onConfirm={() => void approveSelected()}
        />
      </div>
    </RequirePermission>
  );
}
