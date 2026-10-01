"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { useDepartments } from "@/hooks/use-departments";
import { useAuth } from "@/contexts/auth-context";
import { importLegacyEmployee } from "@/lib/services/legacy-import";
import {
  applyLegacyFiles,
  blankLegacyDraft,
  downloadLegacyTemplate,
  legacyDuplicateFields,
  legacyRowIssues,
  matchDepartment,
  parseLegacyWorkbook,
  type LegacyDraft,
} from "@/lib/onboarding/legacy-sheet";
import type { UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type RowStatus = "pending" | "importing" | "done" | "failed";

interface ImportRow extends LegacyDraft {
  status: RowStatus;
  message?: string;
  temporaryPassword?: string;
  employeeId?: string;
}

function asRow(draft: LegacyDraft, previous?: ImportRow): ImportRow {
  return {
    ...draft,
    status: previous?.status === "done" ? "done" : "pending",
    message: previous?.status === "done" ? previous.message : undefined,
    temporaryPassword: previous?.temporaryPassword,
    employeeId: previous?.employeeId,
    jdFile: previous?.status === "done" ? previous.jdFile : draft.jdFile,
    tniFile: previous?.status === "done" ? previous.tniFile : draft.tniFile,
  };
}

export default function LegacyEmployeesPage() {
  const { profile } = useAuth();
  const { activeDepartments, loading: deptLoading } = useDepartments();
  const sheetRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const departmentsRef = useRef(activeDepartments);
  departmentsRef.current = activeDepartments;
  const departmentKey = activeDepartments.map((d) => `${d.id}:${d.name}:${d.code}`).join("|");
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const departments = departmentsRef.current;
    if (!departments.length) return;
    setRows((current) => {
      let changed = false;
      const next = current.map((row) => {
        if (row.departmentId || !row.departmentName || row.status === "done") return row;
        const dept = matchDepartment(row.departmentName, departments);
        if (!dept) return row;
        changed = true;
        return { ...row, departmentId: dept.id, departmentName: dept.name };
      });
      return changed ? next : current;
    });
  }, [departmentKey]);

  const duplicates = useMemo(() => legacyDuplicateFields(rows), [rows]);
  const issuesFor = (row: ImportRow) =>
    row.status === "done"
      ? []
      : legacyRowIssues(row, {
          duplicateCode: duplicates.codes.has(row.employeeCode.trim().toUpperCase()),
          duplicateJd: duplicates.jdNumbers.has(row.jdNo.trim().toUpperCase()),
        });

  const readyCount = rows.filter((row) => issuesFor(row).length === 0).length;

  const updateRow = (key: string, patch: Partial<ImportRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const onSheet = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseLegacyWorkbook(await file.arrayBuffer(), activeDepartments);
      setRows((current) => {
        const codes = new Set(current.map((row) => row.employeeCode.toUpperCase()).filter(Boolean));
        const added = parsed
          .filter((row) => !codes.has(row.employeeCode.toUpperCase()))
          .map((row) => asRow(row));
        const merged = [...current, ...added];
        const attached = applyLegacyFiles(
          merged,
          merged.flatMap((row) => [row.jdFile, row.tniFile].filter((item): item is File => Boolean(item)))
        );
        return attached.rows.map((row) => {
          const prev = merged.find((item) => item.key === row.key);
          return asRow(row, prev);
        });
      });
      toast.success(`Loaded ${parsed.length} employee row${parsed.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read the spreadsheet");
    } finally {
      if (sheetRef.current) sheetRef.current.value = "";
    }
  };

  const onFiles = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (!files.length) return;
    const current = rowsRef.current;
    const attached = applyLegacyFiles(current, files);
    setUnmatched(attached.unmatched);
    setRows(
      attached.rows.map((row) => {
        const prev = current.find((item) => item.key === row.key);
        return asRow(row, prev && prev.status === "done" ? prev : undefined);
      })
    );
    if (attached.unmatched.length) {
      toast.error("Some files could not be matched to an employee code");
    } else {
      toast.success("JD and TNI files matched to employee codes");
    }
    if (filesRef.current) filesRef.current.value = "";
  };

  const importRows = async () => {
    if (!profile) return;
    const actor = {
      uid: profile.uid,
      name: profile.displayName,
      role: profile.role as UserRole,
    };
    const pending = rows.filter((row) => issuesFor(row).length === 0);
    if (!pending.length) {
      toast.error("Add employee rows with a department, JD file, and TNI file first");
      return;
    }
    setImporting(true);
    let saved = 0;
    for (const row of pending) {
      updateRow(row.key, { status: "importing", message: undefined });
      try {
        const result = await importLegacyEmployee(row, actor);
        saved += 1;
        updateRow(row.key, {
          status: "done",
          message: "Imported",
          temporaryPassword: result.temporaryPassword,
          employeeId: result.employeeId,
        });
      } catch (err) {
        updateRow(row.key, {
          status: "failed",
          message: err instanceof Error ? err.message : "Import failed",
        });
      }
    }
    setImporting(false);
    if (saved) toast.success(`Imported ${saved} employee${saved === 1 ? "" : "s"}`);
  };

  const downloadResults = () => {
    const done = rows.filter((row) => row.status === "done" && row.temporaryPassword);
    if (!done.length) {
      toast.error("Import employees first — passwords are shown only after a successful import");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(
      done.map((row) => ({
        "Employee code": row.employeeCode,
        Name: row.name,
        "Login ID": row.employeeCode,
        "Temporary password": row.temporaryPassword,
        "Login URL": `${window.location.origin}/login`,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Credentials");
    XLSX.writeFile(wb, "pre-system-credentials.xlsx");
  };

  return (
    <RequirePermission permission={["employees:onboard", "employees:write"]} mode="any">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" asChild>
              <Link href="/dashboard/employees/new">
                <ArrowLeft className="mr-1 h-4 w-4" />
                New hire onboarding
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Employees from before this software</h1>
            <p className="max-w-3xl text-muted-foreground">
              Bulk-enter people who were already onboarded, and whose Job Description and TNI were
              prepared before this LMS. Their accounts are created at the TNI stage, and the existing
              JD and TNI files are stored on the record.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How to load them</CardTitle>
            <CardDescription>
              Department names in the sheet must match Departments in this system. Name each file
              with the employee code, for example EMP1001_JD.pdf or EMP1001_JD_signed.pdf.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadLegacyTemplate}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download Excel template
            </Button>
            <Button type="button" variant="outline" onClick={() => sheetRef.current?.click()} disabled={importing}>
              <Upload className="mr-2 h-4 w-4" />
              Upload spreadsheet
            </Button>
            <Button type="button" variant="outline" onClick={() => filesRef.current?.click()} disabled={importing || rows.length === 0}>
              <FileUp className="mr-2 h-4 w-4" />
              Upload JD and TNI files
            </Button>
            <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, asRow(blankLegacyDraft())])} disabled={importing}>
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
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </CardContent>
        </Card>

        {unmatched.length > 0 && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            These files were not matched. Rename them as CODE_JD or CODE_TNI: {unmatched.join(", ")}
          </p>
        )}

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Employee list</CardTitle>
              <CardDescription>
                {rows.length === 0
                  ? "Upload the spreadsheet or add a row."
                  : `${readyCount} ready to import · ${rows.filter((row) => row.status === "done").length} saved`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadResults} disabled={importing}>
                <Download className="mr-2 h-4 w-4" />
                Download passwords
              </Button>
              <Button type="button" onClick={() => void importRows()} disabled={importing || readyCount === 0}>
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {readyCount > 0 ? readyCount : ""}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {deptLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No employees in this batch yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Date of joining</TableHead>
                    <TableHead>JD file</TableHead>
                    <TableHead>TNI file</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const issues = issuesFor(row);
                    const locked = importing || row.status === "done" || row.status === "importing";
                    return (
                      <TableRow key={row.key}>
                        <TableCell className="min-w-[140px] space-y-2">
                          <Input
                            value={row.employeeCode}
                            disabled={locked}
                            className="uppercase"
                            placeholder="Employee code"
                            onChange={(e) =>
                              updateRow(row.key, { employeeCode: e.target.value.toUpperCase(), status: "pending" })
                            }
                          />
                          <Input
                            value={row.jdNo}
                            disabled={locked}
                            className="uppercase"
                            placeholder="JD number (optional)"
                            onChange={(e) =>
                              updateRow(row.key, { jdNo: e.target.value.toUpperCase(), status: "pending" })
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[180px] space-y-2">
                          <Input
                            value={row.name}
                            disabled={locked}
                            placeholder="Employee name"
                            onChange={(e) => updateRow(row.key, { name: e.target.value, status: "pending" })}
                          />
                          <Input
                            value={row.email}
                            disabled={locked}
                            placeholder="Email (optional)"
                            onChange={(e) => updateRow(row.key, { email: e.target.value, status: "pending" })}
                          />
                          <Input
                            value={row.mobile}
                            disabled={locked}
                            placeholder="Mobile (optional)"
                            onChange={(e) => updateRow(row.key, { mobile: e.target.value, status: "pending" })}
                          />
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <Select
                            value={row.departmentId || undefined}
                            disabled={locked}
                            onValueChange={(value) => {
                              const dept = activeDepartments.find((item) => item.id === value);
                              updateRow(row.key, {
                                departmentId: value,
                                departmentName: dept?.name || row.departmentName,
                                status: "pending",
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={row.departmentName || "Select"} />
                            </SelectTrigger>
                            <SelectContent>
                              {activeDepartments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <Input
                            value={row.designation}
                            disabled={locked}
                            onChange={(e) => updateRow(row.key, { designation: e.target.value, status: "pending" })}
                          />
                        </TableCell>
                        <TableCell className="min-w-[150px]">
                          <Input
                            type="date"
                            value={row.dateOfJoining}
                            disabled={locked}
                            onChange={(e) => updateRow(row.key, { dateOfJoining: e.target.value, dateIssue: undefined, status: "pending" })}
                          />
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <label className="block text-xs">
                            <span className={row.jdFile ? "text-foreground" : "text-muted-foreground"}>
                              {row.jdFile?.name || "Choose JD"}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.ppt,.pptx"
                              className="mt-1 block w-full text-xs"
                              disabled={locked}
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                e.target.value = "";
                                updateRow(row.key, { jdFile: file, status: "pending" });
                              }}
                            />
                          </label>
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <label className="block text-xs">
                            <span className={row.tniFile ? "text-foreground" : "text-muted-foreground"}>
                              {row.tniFile?.name || "Choose TNI"}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.ppt,.pptx"
                              className="mt-1 block w-full text-xs"
                              disabled={locked}
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                e.target.value = "";
                                updateRow(row.key, { tniFile: file, status: "pending" });
                              }}
                            />
                          </label>
                        </TableCell>
                        <TableCell className="min-w-[160px] text-xs">
                          {row.status === "importing" && <span>Saving…</span>}
                          {row.status === "done" && (
                            <span>
                              Saved.{" "}
                              {row.employeeId && (
                                <Link className="text-primary hover:underline" href={`/dashboard/employees/${row.employeeId}`}>
                                  Open profile
                                </Link>
                              )}
                              {row.temporaryPassword && (
                                <span className="mt-1 block font-mono text-[11px]">
                                  Password: {row.temporaryPassword}
                                </span>
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
