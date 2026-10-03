"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileSpreadsheet,
  FileUp,
  FolderUp,
  Layers,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { useDepartments } from "@/hooks/use-departments";
import { useAuth } from "@/contexts/auth-context";
import { createSopWithFiles, type SopActor } from "@/lib/services/sops";
import {
  applySopBulkFiles,
  blankSopBulkDraft,
  downloadSopBulkTemplate,
  isSopBulkUploadFile,
  parseSopBulkWorkbook,
  resolveDepartments,
  sopBulkRowIssues,
  type SopBulkDraft,
} from "@/lib/sops/bulk-sheet";
import { reviewDateFromEffective } from "@/lib/utils";
import type { UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RowStatus = "pending" | "creating" | "done" | "failed";

interface BulkRow extends SopBulkDraft {
  status: RowStatus;
  message?: string;
  sopId?: string;
}

const FILE_ACCEPT = ".pdf,.ppt,.pptx,.mp4,.webm,.mov";

function asRow(draft: SopBulkDraft, previous?: BulkRow): BulkRow {
  const keepSaved = previous?.status === "done";
  return {
    ...draft,
    status: keepSaved ? "done" : "pending",
    message: keepSaved ? previous.message : undefined,
    sopId: keepSaved ? previous.sopId : undefined,
    files: keepSaved ? previous.files : draft.files,
  };
}

export default function BulkSopPage() {
  const { profile } = useAuth();
  const { activeDepartments, loading: deptLoading } = useDepartments();
  const sheetRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const departmentsRef = useRef(activeDepartments);
  departmentsRef.current = activeDepartments;
  const departmentKey = activeDepartments.map((d) => `${d.id}:${d.name}:${d.code}`).join("|");

  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  useEffect(() => {
    const departments = departmentsRef.current;
    if (!departments.length) return;
    setRows((current) => {
      let changed = false;
      const next = current.map((row) => {
        if (!row.departmentText || row.status === "done" || row.departmentIds.length) return row;
        const resolved = resolveDepartments(row.departmentText, departments);
        if (!resolved.departmentIds.length && resolved.unmatchedDepartments.join() === row.unmatchedDepartments.join()) {
          return row;
        }
        changed = true;
        return { ...row, ...resolved };
      });
      return changed ? next : current;
    });
  }, [departmentKey]);

  const duplicateNumbers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const code = row.sopNumber.trim().toUpperCase();
      if (!code || row.status === "done") continue;
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([code]) => code)
    );
  }, [rows]);

  const rowIssues = (row: BulkRow) =>
    sopBulkRowIssues(row, duplicateNumbers.has(row.sopNumber.trim().toUpperCase()));

  const issuesFor = (row: BulkRow) =>
    row.status === "done" || row.status === "creating" ? [] : rowIssues(row);

  const canCreate = (row: BulkRow) =>
    row.status !== "done" && row.status !== "creating" && rowIssues(row).length === 0;

  const readyCount = rows.filter(canCreate).length;

  const updateRow = (key: string, patch: Partial<BulkRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const onSheet = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseSopBulkWorkbook(await file.arrayBuffer(), activeDepartments);
      setRows((current) => {
        const codes = new Set(current.map((row) => row.sopNumber.toUpperCase()).filter(Boolean));
        const added = parsed
          .filter((row) => !codes.has(row.sopNumber.toUpperCase()))
          .map((row) => asRow(row));
        const merged = [...current, ...added];
        const attached = applySopBulkFiles(
          merged,
          merged.flatMap((row) => row.files)
        );
        return attached.rows.map((row) => {
          const prev = merged.find((item) => item.key === row.key);
          return asRow(row, prev);
        });
      });
      toast.success(`Loaded ${parsed.length} SOP row${parsed.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read the spreadsheet");
    } finally {
      if (sheetRef.current) sheetRef.current.value = "";
    }
  };

  const onFiles = (list: FileList | null) => {
    const picked = list ? Array.from(list) : [];
    const files = picked.filter((file) => isSopBulkUploadFile(file.name));
    const skipped = picked.length - files.length;
    if (!files.length) {
      toast.error(picked.length ? "Choose PDF, PPT, or video files" : "No files selected");
      if (filesRef.current) filesRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
      return;
    }
    const current = rowsRef.current;
    const attached = applySopBulkFiles(current, files);
    setUnmatched(attached.unmatched);
    setRows(
      attached.rows.map((row) => {
        const prev = current.find((item) => item.key === row.key);
        return asRow(row, prev && prev.status === "done" ? prev : undefined);
      })
    );
    const matched = files.length - attached.unmatched.length;
    if (matched) {
      toast.success(`Matched ${matched} file${matched === 1 ? "" : "s"} to SOP numbers`);
    }
    if (attached.unmatched.length) {
      toast.error("Some PDFs could not be matched. Put the SOP number in the file or folder name");
    }
    if (skipped) {
      toast.message(`Skipped ${skipped} file${skipped === 1 ? "" : "s"} that are not PDF, PPT, or video`);
    }
    if (filesRef.current) filesRef.current.value = "";
    if (folderRef.current) folderRef.current.value = "";
  };

  const createRows = async () => {
    if (!profile) return;
    const actor: SopActor = {
      uid: profile.uid,
      name: profile.displayName,
      email: profile.email,
      role: profile.role as UserRole,
      employeeId: profile.employeeId,
    };
    const pending = rows.filter(canCreate);
    if (!pending.length) {
      toast.error("Add SOP rows with a department and at least one file first");
      return;
    }
    setCreating(true);
    let saved = 0;
    for (const row of pending) {
      updateRow(row.key, { status: "creating", message: undefined });
      try {
        const effective = row.effectiveDate ? new Date(row.effectiveDate).toISOString() : undefined;
        const reviewSource = row.reviewDate || reviewDateFromEffective(row.effectiveDate);
        const { sop } = await createSopWithFiles(
          {
            sopNumber: row.sopNumber,
            title: row.title,
            description: "",
            category: "",
            versionNumber: row.versionNumber,
            departmentIds: row.departmentIds,
            tags: [],
            changeSummary: "Initial release",
            effectiveDate: effective,
            reviewDate: reviewSource ? new Date(reviewSource).toISOString() : undefined,
            files: row.files,
          },
          actor
        );
        saved += 1;
        updateRow(row.key, { status: "done", message: "Created", sopId: sop.id });
      } catch (err) {
        updateRow(row.key, {
          status: "failed",
          message: err instanceof Error ? err.message : "Create failed",
        });
      }
    }
    setCreating(false);
    if (saved) toast.success(`Created ${saved} SOP draft${saved === 1 ? "" : "s"}`);
  };

  return (
    <RequirePermission permission="sops:write">
      <div className="space-y-6">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" asChild>
            <Link href="/dashboard/sops/new">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Single SOP
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Bulk SOP entry</h1>
          <p className="max-w-3xl text-muted-foreground">
            Upload the spreadsheet first, then upload the PDFs in one batch. Each PDF is attached to
            the row whose SOP number is in the file name or the folder name.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              How to load them
            </CardTitle>
            <CardDescription>
              Department names or codes must match Departments in this system. Separate several
              departments with commas. After the spreadsheet is loaded, select every PDF at once or
              choose the folder that contains them. Name a file SOP-QA-004.pdf, or put it in a folder
              named SOP-QA-004.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadSopBulkTemplate}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download Excel template
            </Button>
            <Button type="button" variant="outline" onClick={() => sheetRef.current?.click()} disabled={creating}>
              <Upload className="mr-2 h-4 w-4" />
              Upload spreadsheet
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => filesRef.current?.click()}
              disabled={creating || rows.length === 0}
            >
              <FileUp className="mr-2 h-4 w-4" />
              Upload PDFs
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => folderRef.current?.click()}
              disabled={creating || rows.length === 0}
            >
              <FolderUp className="mr-2 h-4 w-4" />
              Upload PDF folder
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRows((current) => [...current, asRow(blankSopBulkDraft())])}
              disabled={creating}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add one row
            </Button>
            <input
              ref={sheetRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => void onSheet(e.target.files?.[0])}
            />
            <input
              ref={filesRef}
              type="file"
              accept={FILE_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <input
              ref={folderRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </CardContent>
        </Card>

        {unmatched.length > 0 && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            These files were not matched. Put the SOP number in the file name or folder name:{" "}
            {unmatched.join(", ")}
          </p>
        )}

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>SOP list</CardTitle>
              <CardDescription>
                {rows.length === 0
                  ? "Upload the spreadsheet or add a row."
                  : `${readyCount} ready to create · ${rows.filter((row) => row.status === "done").length} saved`}
              </CardDescription>
            </div>
            <Button type="button" onClick={() => void createRows()} disabled={creating || readyCount === 0}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {readyCount > 0 ? readyCount : ""} draft{readyCount === 1 ? "" : "s"}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {deptLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No SOPs in this batch yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SOP number</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Departments</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const issues = issuesFor(row);
                    const locked = creating || row.status === "done" || row.status === "creating";
                    return (
                      <TableRow key={row.key}>
                        <TableCell className="min-w-[150px]">
                          <Input
                            value={row.sopNumber}
                            disabled={locked}
                            className="uppercase"
                            placeholder="SOP-QA-004"
                            onChange={(e) =>
                              updateRow(row.key, {
                                sopNumber: e.target.value.toUpperCase(),
                                status: "pending",
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <Input
                            value={row.title}
                            disabled={locked}
                            placeholder="Title"
                            onChange={(e) => updateRow(row.key, { title: e.target.value, status: "pending" })}
                          />
                        </TableCell>
                        <TableCell className="min-w-[90px]">
                          <Input
                            value={row.versionNumber}
                            disabled={locked}
                            placeholder="1"
                            onChange={(e) =>
                              updateRow(row.key, { versionNumber: e.target.value, status: "pending" })
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="space-y-1">
                            {activeDepartments.map((dept) => (
                              <label key={dept.id} className="flex items-center gap-2 text-xs">
                                <Checkbox
                                  checked={row.departmentIds.includes(dept.id)}
                                  disabled={locked}
                                  onCheckedChange={(checked) =>
                                    updateRow(row.key, {
                                      departmentIds:
                                        checked === true
                                          ? [...row.departmentIds, dept.id]
                                          : row.departmentIds.filter((id) => id !== dept.id),
                                      departmentText: "",
                                      unmatchedDepartments: [],
                                      status: "pending",
                                    })
                                  }
                                />
                                {dept.name}
                              </label>
                            ))}
                            {!activeDepartments.length && (
                              <p className="text-xs text-muted-foreground">No departments found.</p>
                            )}
                            {row.unmatchedDepartments.length > 0 && (
                              <p className="text-xs text-amber-700 dark:text-amber-300">
                                Unknown: {row.unmatchedDepartments.join(", ")}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[160px] space-y-2">
                          <Input
                            type="date"
                            value={row.effectiveDate}
                            disabled={locked}
                            onChange={(e) =>
                              updateRow(row.key, {
                                effectiveDate: e.target.value,
                                effectiveDateIssue: undefined,
                                reviewDate: reviewDateFromEffective(e.target.value) || row.reviewDate,
                                reviewDateIssue: undefined,
                                status: "pending",
                              })
                            }
                          />
                          <Input
                            type="date"
                            value={row.reviewDate}
                            disabled={locked}
                            onChange={(e) =>
                              updateRow(row.key, {
                                reviewDate: e.target.value,
                                reviewDateIssue: undefined,
                                status: "pending",
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[180px] space-y-1">
                          {row.files.map((file) => (
                            <p key={`${file.name}-${file.size}`} className="truncate text-xs">
                              {file.name}
                            </p>
                          ))}
                          <label className="block text-xs text-muted-foreground">
                            {row.files.length ? "Add another file" : "Choose file"}
                            <input
                              type="file"
                              accept={FILE_ACCEPT}
                              multiple
                              className="mt-1 block w-full text-xs"
                              disabled={locked}
                              onChange={(e) => {
                                const picked = e.target.files ? Array.from(e.target.files) : [];
                                if (!picked.length) return;
                                const merged = [...row.files];
                                for (const file of picked) {
                                  if (!merged.some((item) => item.name === file.name && item.size === file.size)) {
                                    merged.push(file);
                                  }
                                }
                                updateRow(row.key, { files: merged, status: "pending" });
                              }}
                            />
                          </label>
                        </TableCell>
                        <TableCell className="min-w-[160px] text-xs">
                          {row.status === "creating" && <span>Saving…</span>}
                          {row.status === "done" && (
                            <span>
                              Draft saved.{" "}
                              {row.sopId && (
                                <Link className="text-primary hover:underline" href={`/dashboard/sops/${row.sopId}`}>
                                  Open SOP
                                </Link>
                              )}
                            </span>
                          )}
                          {row.status === "failed" && <span className="text-destructive">{row.message}</span>}
                          {row.status === "pending" && issues.length > 0 && (
                            <span className="text-amber-700 dark:text-amber-300">Missing: {issues.join(", ")}</span>
                          )}
                          {row.status === "pending" && issues.length === 0 && <span>Ready</span>}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={locked}
                            onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
