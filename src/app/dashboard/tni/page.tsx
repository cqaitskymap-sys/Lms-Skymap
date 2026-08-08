"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Pencil, Plus, Printer, Sparkles, Trash2 } from "lucide-react";
import { draftTniWithAi } from "@/lib/services/ai";
import {
  approveTNI,
  createTNI,
  deleteTNI,
  listJobDescriptions,
  listTNIs,
  syncLocalTnisToFirebase,
  updateTNI,
} from "@/lib/services/training";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";
import {
  createTniLifecycle,
  listEmployeesForLifecycle,
  type LifecycleActor,
} from "@/lib/services/lifecycle";
import { getEmployee } from "@/lib/services/employees";
import { departmentLabel, listDepartments } from "@/lib/services/departments";
import { listSopsDetailed } from "@/lib/services/sops";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { escapeHtml, printHtml } from "@/lib/print";
import type {
  Department,
  Employee,
  JobDescription,
  SopDocument,
  TrainingNeedItem,
  TrainingNeedIdentification,
  UserRole,
} from "@/types";

const POST_JD_STAGES = [
  "jd_created",
  "tni_created",
  "trainer_assigned",
  "sop_assigned",
  "training",
  "exam",
  "passed",
  "certified",
  "qualified",
] as const;

interface NeedRow {
  id: string;
  topic: string;
  sopId: string;
  priority: TrainingNeedItem["priority"];
  rationale: string;
  targetCompletionDate?: string;
}

function formatDateForPrint(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function addDays(isoDate: string | undefined, days: number): string | undefined {
  if (!isoDate) return undefined;
  const base = new Date(isoDate);
  if (Number.isNaN(base.getTime())) return undefined;
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

function statusBadgeVariant(status: TrainingNeedIdentification["status"]) {
  if (status === "approved" || status === "completed") return "default" as const;
  if (status === "in_progress") return "secondary" as const;
  return "outline" as const;
}

export default function TniPage() {
  const searchParams = useSearchParams();
  const employeeFromUrl = searchParams.get("employee") || "";
  const { profile, can } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [sops, setSops] = useState<SopDocument[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [jdId, setJdId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [records, setRecords] = useState<TrainingNeedIdentification[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const actor: LifecycleActor | null = useMemo(() => {
    if (!profile) return null;
    return {
      uid: profile.uid,
      name: profile.displayName,
      role: profile.role as UserRole,
    };
  }, [profile]);

  const deptScopeId =
    profile?.role === "department_head" ? profile.departmentId : undefined;
  const employeeScopeId =
    profile?.role === "employee" ? profile.employeeId : undefined;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isEmployee = profile?.role === "employee";
      const myEmployeeId = profile?.employeeId;

      if (isEmployee) {
        if (!myEmployeeId) {
          setEmployees([]);
          setDepartments([]);
          setJds([]);
          setSops([]);
          setRecords([]);
          setError("Your account is not linked to an employee profile");
          return;
        }
        const [depts, jdList, sopList, tniList, self] = await Promise.all([
          listDepartments(),
          listJobDescriptions({ employeeId: myEmployeeId }),
          listSopsDetailed({ status: "approved" }),
          listTNIs({ employeeId: myEmployeeId }),
          getEmployee(myEmployeeId).catch(() => null),
        ]);
        setEmployees(self ? [self] : []);
        setDepartments(depts.filter((d) => d.isActive));
        setJds(jdList);
        setSops(sopList);
        setRecords(tniList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        return;
      }

      const [emps, depts, jdList, sopList, tniList] = await Promise.all([
        listEmployeesForLifecycle(),
        listDepartments(),
        listJobDescriptions(),
        listSopsDetailed({ status: "approved" }),
        listTNIs(),
      ]);
      setEmployees(emps);
      setDepartments(depts.filter((d) => d.isActive));
      setJds(jdList);
      setSops(sopList);
      setRecords(tniList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load TNI data");
      setEmployees([]);
      setJds([]);
      setSops([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.employeeId]);

  useEffect(() => {
    void (async () => {
      // Only staff sync local demo TNIs — employees are read-only on this page.
      if (profile?.role !== "employee") {
        try {
          const synced = await syncLocalTnisToFirebase();
          if (synced > 0) toast.success(`Synced ${synced} local TNI(s) to Firebase`);
        } catch {
          /* non-blocking */
        }
      }
      await loadData();
    })();
    const onUpdate = () => void loadData();
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => {
      window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
    };
  }, [loadData, profile?.role]);

  useEffect(() => {
    if (employeeFromUrl) setEmployeeId(employeeFromUrl);
  }, [employeeFromUrl]);

  const approvedJds = useMemo(() => jds.filter((j) => j.status === "approved"), [jds]);

  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const linked =
      approvedJds.find((j) => j.id === emp.jdId) ||
      approvedJds.find((j) => j.employeeId === emp.id);
    if (linked) {
      setJdId(linked.id);
      setJobTitle(linked.title);
      setResponsibilities(linked.responsibilities.join("\n"));
    } else if (emp.designation) {
      setJobTitle(emp.designation);
      setJdId("");
    }
  }, [employeeId, employees, approvedJds]);

  const scopedEmployees = useMemo(() => {
    if (employeeScopeId) {
      return employees.filter((e) => e.id === employeeScopeId);
    }
    if (deptScopeId) {
      return employees.filter((e) => e.departmentId === deptScopeId);
    }
    return employees;
  }, [employees, deptScopeId, employeeScopeId]);

  const employeesWithTni = useMemo(
    () => new Set(records.map((r) => r.employeeId)),
    [records]
  );

  const eligible = useMemo(
    () =>
      scopedEmployees.filter(
        (e) =>
          POST_JD_STAGES.includes(e.lifecycleStage as (typeof POST_JD_STAGES)[number]) &&
          !employeesWithTni.has(e.id) &&
          !e.tniId &&
          approvedJds.some((j) => j.employeeId === e.id || j.id === e.jdId)
      ),
    [scopedEmployees, employeesWithTni, approvedJds]
  );

  const visibleRecords = useMemo(() => {
    let rows = records;
    if (employeeScopeId) {
      rows = rows.filter((r) => r.employeeId === employeeScopeId);
    } else if (deptScopeId) {
      rows = rows.filter((r) => r.departmentId === deptScopeId);
    }
    return rows;
  }, [records, deptScopeId, employeeScopeId]);

  const employeeJds = useMemo(
    () =>
      approvedJds.filter((j) => !employeeId || j.employeeId === employeeId),
    [approvedJds, employeeId]
  );

  function resetForm() {
    setEditingId(null);
    setNeeds([]);
    setEmployeeId("");
    setJdId("");
    setJobTitle("");
    setResponsibilities("");
  }

  function printTniSheet(args: {
    employee: Employee;
    selectedJd?: JobDescription;
    selectedNeeds: NeedRow[];
  }) {
    if (typeof window === "undefined") return;
    const { employee, selectedJd, selectedNeeds } = args;

    const rowsHtml = selectedNeeds
      .map((need, index) => {
        const sop = sops.find((s) => s.id === need.sopId);
        const sopRef = sop ? escapeHtml(sop.sopNumber) : "NA";
        const plannedDate = formatDateForPrint(
          need.targetCompletionDate || addDays(employee.dateOfJoining, index < 6 ? 1 : 2)
        );
        return `
          <tr>
            <td class="center">${index + 1}</td>
            <td>${escapeHtml(need.topic || "—")}</td>
            <td class="center">${sopRef}</td>
            <td class="center">${escapeHtml(plannedDate)}</td>
            <td></td>
          </tr>
        `;
      })
      .join("");

    const fullName = `${employee.firstName} ${employee.lastName}`.trim();
    const departmentName = employee.departmentName || departmentLabel(departments, employee.departmentId) || "—";
    const designation = selectedJd?.title || employee.designation || "—";
    const experience =
      employee.employmentType === "intern" || employee.employmentType === "temporary"
        ? "Fresher"
        : "Experienced";

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>TNI - ${escapeHtml(employee.employeeCode)}</title>
          <style>
            body { margin: 0; font-family: "Times New Roman", serif; color: #111; background: #fff; }
            .sheet { width: 980px; margin: 16px auto; border: 1px solid #222; padding: 10px 12px; box-sizing: border-box; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            .header-table td { border: 1px solid #666; padding: 4px 6px; vertical-align: middle; }
            .logo-cell { width: 96px; text-align: center; }
            .logo-cell img { width: 72px; height: auto; }
            .title-1, .title-2, .title-3 { text-align: center; font-weight: 700; }
            .title-1 { font-size: 18px; }
            .title-2 { font-size: 16px; }
            .title-3 { font-size: 17px; }
            .meta { width: 100%; border-collapse: collapse; margin: 8px 0; }
            .meta td { padding: 3px 6px; border: none; font-size: 14px; }
            .meta b { margin-right: 6px; }
            .grid { width: 100%; border-collapse: collapse; }
            .grid th, .grid td { border: 1px solid #333; padding: 5px 8px; font-size: 13px; vertical-align: top; }
            .grid th { text-align: center; font-weight: 700; }
            .center { text-align: center; }
            .signatures { width: 100%; margin-top: 48px; border-collapse: collapse; }
            .signatures td { width: 50%; vertical-align: top; border: none; padding: 0; font-size: 14px; line-height: 1.55; }
            .signatures .right { text-align: right; }
            .signatures .title { font-weight: 700; margin-bottom: 4px; }
            .signatures .role { margin-bottom: 28px; }
            .footer { margin-top: 28px; font-size: 14px; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <table class="header-table">
              <tr>
                <td class="logo-cell" rowspan="3">
                  <img src="${window.location.origin}/brand/skymap-logo.png" alt="SkyMap logo" />
                </td>
                <td class="title-1">SKYMAP PHARMACEUTICALS PVT. LTD, ROORKEE</td>
              </tr>
              <tr>
                <td class="title-2">${escapeHtml(departmentName.toUpperCase())}</td>
              </tr>
              <tr>
                <td class="title-3">TRAINING NEED IDENTIFICATION FOR NEW JOINEE</td>
              </tr>
            </table>
            <table class="meta">
              <tr>
                <td><b>Employee Name:</b> ${escapeHtml(fullName)}</td>
                <td><b>Designation:</b> ${escapeHtml(designation)}</td>
                <td><b>Department:</b> ${escapeHtml(departmentName)}</td>
              </tr>
              <tr>
                <td><b>Date of Joining:</b> ${escapeHtml(formatDateForPrint(employee.dateOfJoining))}</td>
                <td><b>Employee Code:</b> ${escapeHtml(employee.employeeCode)}</td>
                <td><b>Experience:</b> ${escapeHtml(experience)}</td>
              </tr>
            </table>
            <table class="grid">
              <thead>
                <tr>
                  <th style="width:7%">S. No.</th>
                  <th style="width:37%">Training Subject</th>
                  <th style="width:22%">Reference SOP No./Doc. No.</th>
                  <th style="width:17%">Date of Training Planned</th>
                  <th style="width:17%">Date of Execution</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td class="center">1</td><td>—</td><td class="center">NA</td><td class="center">—</td><td></td></tr>'}
              </tbody>
            </table>
            <table class="signatures">
              <tr>
                <td>
                  <div class="title">Prepared By</div>
                  <div class="role">Department Training Coordinator/HOD</div>
                  <div>Sign/Date</div>
                </td>
                <td class="right">
                  <div class="title">Approved By</div>
                  <div class="role">Head-Quality Assurance/Designee</div>
                  <div>Sign/Date</div>
                </td>
              </tr>
            </table>
            <div class="footer">
              <span>FORMAT No.: SOP/QA/002/F08-03</span>
              <span>Page 1 of 1</span>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      printHtml(html, `TNI - ${employee.employeeCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open print dialog");
    }
  }

  function addNeed() {
    setNeeds((n) => [
      ...n,
      {
        id: crypto.randomUUID(),
        topic: "",
        sopId: "",
        priority: "medium" as const,
        rationale: "",
      },
    ]);
  }

  async function handleAiSuggest() {
    if (!jobTitle.trim() || responsibilities.trim().length < 10) {
      toast.error("Enter job title and responsibilities first");
      return;
    }
    setAiBusy(true);
    try {
      const { needs: drafted, model } = await draftTniWithAi({
        jobTitle: jobTitle.trim(),
        responsibilities: responsibilities.trim(),
      });
      setNeeds(
        drafted.map((n) => ({
          id: crypto.randomUUID(),
          topic: n.topic,
          sopId: "",
          priority: n.priority as NeedRow["priority"],
          rationale: n.rationale,
        }))
      );
      toast.success(`Suggested ${drafted.length} training needs (${model})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI suggest failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function handleSubmit() {
    if (!actor || !profile) return;
    if (!employeeId) {
      toast.error("Select an employee");
      return;
    }
    if (!jdId) {
      toast.error("Link an approved Job Description first");
      return;
    }
    const linkedJd = jds.find((j) => j.id === jdId);
    if (!linkedJd || linkedJd.status !== "approved") {
      toast.error("Selected JD must be approved before creating TNI");
      return;
    }
    if (!needs.length || needs.some((n) => !n.topic.trim())) {
      toast.error("Add at least one training need with a topic");
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    const dept = emp?.departmentId || linkedJd.departmentId;
    if (!dept) {
      toast.error("Employee department missing");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        employeeId,
        departmentId: dept,
        jdId,
        needs: needs.map((n) => {
          const item: TrainingNeedItem = {
            id: n.id,
            topic: n.topic.trim(),
            priority: n.priority,
            rationale: n.rationale.trim(),
            status: "identified",
          };
          if (n.sopId) item.sopId = n.sopId;
          if (n.targetCompletionDate) item.targetCompletionDate = n.targetCompletionDate;
          return item;
        }),
      };

      if (editingId) {
        const tni = await updateTNI(editingId, payload, profile.uid);
        toast.success(`TNI updated (${tni.id})`);
      } else {
        const tni = await createTNI(payload, profile.uid);
        await createTniLifecycle(employeeId, tni.id, actor);
        toast.success(`TNI submitted (${tni.id})`);
      }

      await loadData();
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit TNI");
    } finally {
      setBusy(false);
    }
  }

  function handleEdit(record: TrainingNeedIdentification) {
    const linkedJd = jds.find((j) => j.id === record.jdId);
    setEditingId(record.id);
    setEmployeeId(record.employeeId);
    setJdId(record.jdId);
    setJobTitle(linkedJd?.title || "");
    setResponsibilities((linkedJd?.responsibilities || []).join("\n"));
    setNeeds(
      record.needs.map((n) => ({
        id: n.id || crypto.randomUUID(),
        topic: n.topic,
        sopId: n.sopId || "",
        priority: n.priority,
        rationale: n.rationale,
        targetCompletionDate: n.targetCompletionDate,
      }))
    );
  }

  async function handleDelete(id: string) {
    try {
      await deleteTNI(id);
      if (editingId === id) resetForm();
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  async function handleApprove(record: TrainingNeedIdentification) {
    if (!profile) return;
    setBusy(true);
    try {
      await approveTNI(record.id, profile.uid);
      toast.success("TNI approved");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  function handlePrintSaved(record: TrainingNeedIdentification) {
    const emp = employees.find((e) => e.id === record.employeeId);
    if (!emp) {
      toast.error("Employee details not found for this TNI");
      return;
    }
    printTniSheet({
      employee: emp,
      selectedJd: jds.find((j) => j.id === record.jdId),
      selectedNeeds: record.needs.map((n) => ({
        id: n.id,
        topic: n.topic,
        sopId: n.sopId || "",
        priority: n.priority,
        rationale: n.rationale,
        targetCompletionDate: n.targetCompletionDate,
      })),
    });
  }

  const canWrite = can("tni:write");
  const canApprove = can("tni:approve");

  return (
    <RequirePermission permission="tni:read">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Training Need Identification
          </h1>
          <p className="text-muted-foreground">
            Map approved JD responsibilities to SOP training needs
            {deptScopeId && ` · ${departmentLabel(departments, deptScopeId)}`}
          </p>
        </div>

        {canWrite && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>{editingId ? "Edit TNI" : "Create TNI"}</CardTitle>
                  <CardDescription>
                    Requires an approved Job Description after handover
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={aiBusy || busy}
                  onClick={() => void handleAiSuggest()}
                >
                  {aiBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {aiBusy ? "Suggesting…" : "Suggest with AI"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={employeeId}
                    onValueChange={setEmployeeId}
                    disabled={Boolean(editingId)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {(editingId
                        ? scopedEmployees.filter((e) => e.id === employeeId)
                        : eligible.length
                          ? eligible
                          : scopedEmployees
                      ).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.firstName} {e.lastName} · {e.employeeCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!editingId && eligible.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No eligible employees — ensure JD is approved and no TNI exists yet.{" "}
                      <Link href="/dashboard/jd" className="text-primary hover:underline">
                        Open JD
                      </Link>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Linked JD (approved)</Label>
                  <Select
                    value={jdId}
                    onValueChange={setJdId}
                    disabled={Boolean(editingId)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select JD" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeJds.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Job title</Label>
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    readOnly
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>JD responsibilities (for AI)</Label>
                  <Textarea
                    rows={3}
                    value={responsibilities}
                    onChange={(e) => setResponsibilities(e.target.value)}
                  />
                </div>
              </div>

              {needs.map((need, idx) => (
                <div key={need.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Need #{idx + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setNeeds((n) => n.filter((x) => x.id !== need.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Topic</Label>
                      <Input
                        value={need.topic}
                        onChange={(e) =>
                          setNeeds((n) =>
                            n.map((x) =>
                              x.id === need.id ? { ...x, topic: e.target.value } : x
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Related SOP</Label>
                      <Select
                        value={need.sopId || "__none"}
                        onValueChange={(v) =>
                          setNeeds((n) =>
                            n.map((x) =>
                              x.id === need.id
                                ? { ...x, sopId: v === "__none" ? "" : v }
                                : x
                            )
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select SOP" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">No SOP linked</SelectItem>
                          {sops.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.sopNumber} — {s.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={need.priority}
                        onValueChange={(v) =>
                          setNeeds((n) =>
                            n.map((x) =>
                              x.id === need.id
                                ? { ...x, priority: v as NeedRow["priority"] }
                                : x
                            )
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Rationale</Label>
                      <Textarea
                        rows={2}
                        value={need.rationale}
                        onChange={(e) =>
                          setNeeds((n) =>
                            n.map((x) =>
                              x.id === need.id ? { ...x, rationale: e.target.value } : x
                            )
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={addNeed}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add need
                </Button>
                <Button disabled={busy} onClick={() => void handleSubmit()}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Update TNI" : "Submit TNI"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Saved TNIs</CardTitle>
            <CardDescription>View, edit, approve, delete and print TNI records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : error ? (
              <div className="py-8 text-center">
                <p className="text-destructive">{error}</p>
                <Button className="mt-4" variant="outline" onClick={() => void loadData()}>
                  Retry
                </Button>
              </div>
            ) : visibleRecords.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>No TNI records yet.</p>
                {canWrite && (
                  <p className="mt-1">
                    Approve a JD first, then create TNI for handed-over employees.
                  </p>
                )}
              </div>
            ) : (
              visibleRecords.map((record) => {
                const emp = employees.find((e) => e.id === record.employeeId);
                const linkedJd = jds.find((j) => j.id === record.jdId);
                return (
                  <div
                    key={record.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">
                          {emp
                            ? `${emp.firstName} ${emp.lastName} · ${emp.employeeCode}`
                            : record.employeeId}
                        </p>
                        <Badge variant={statusBadgeVariant(record.status)}>
                          {record.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">v{record.version}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        JD: {linkedJd?.title || record.jdId} · {record.needs.length} need(s)
                      </p>
                      {record.approvedAt && (
                        <p className="text-xs text-muted-foreground">
                          Approved {formatDateForPrint(record.approvedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintSaved(record)}
                      >
                        <Printer className="mr-1 h-3.5 w-3.5" />
                        Print
                      </Button>
                      {canApprove && record.status === "submitted" && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleApprove(record)}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Approve
                        </Button>
                      )}
                      {canWrite && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(record)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      )}
                      <AdminDeleteButton
                        label="Delete"
                        size="sm"
                        variant="destructive"
                        confirmTitle="Delete this TNI?"
                        confirmDescription="Only Super Admin can delete. Employee tniId will be cleared."
                        successMessage="TNI deleted"
                        onDelete={() => handleDelete(record.id)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
