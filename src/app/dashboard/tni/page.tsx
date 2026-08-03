"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Printer, Sparkles, Trash2 } from "lucide-react";
import { draftTniWithAi } from "@/lib/services/ai";
import {
  createTNI,
  deleteTNI,
  listJobDescriptions,
  listTNIs,
  updateTNI,
} from "@/lib/services/training";
import {
  createTniLifecycle,
  listEmployeesForLifecycle,
  type LifecycleActor,
} from "@/lib/services/lifecycle";
import { listSopsDetailed } from "@/lib/services/sops";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import type {
  Employee,
  JobDescription,
  SopDocument,
  TrainingNeedItem,
  TrainingNeedIdentification,
  UserRole,
} from "@/types";

interface NeedRow {
  id: string;
  topic: string;
  sopId: string;
  priority: TrainingNeedItem["priority"];
  rationale: string;
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

export default function TniPage() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
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

  const actor: LifecycleActor | null = useMemo(() => {
    if (!profile) return null;
    return {
      uid: profile.uid,
      name: profile.displayName,
      role: profile.role as UserRole,
    };
  }, [profile]);

  async function loadData() {
    const [emps, jdList, sopList, tniList] = await Promise.all([
      listEmployeesForLifecycle(),
      listJobDescriptions(),
      listSopsDetailed({ status: "approved" }),
      listTNIs(),
    ]);
    setEmployees(emps);
    setJds(jdList);
    setSops(sopList);
    setRecords(tniList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const linked = jds.find((j) => j.id === emp.jdId) || jds.find((j) => j.employeeId === emp.id);
    if (linked) {
      setJdId(linked.id);
      setJobTitle(linked.title);
      setResponsibilities(linked.responsibilities.join("\n"));
    } else if (emp.designation) {
      setJobTitle(emp.designation);
    }
  }, [employeeId, employees, jds]);

  const addNeed = () =>
    setNeeds((n) => [
      ...n,
      {
        id: crypto.randomUUID(),
        topic: "",
        sopId: "",
        priority: "medium",
        rationale: "",
      },
    ]);

  function printTniSheet(args: {
    employee: Employee;
    tni: TrainingNeedIdentification;
    selectedJd?: JobDescription;
    selectedNeeds: NeedRow[];
  }) {
    if (typeof window === "undefined") return;
    const { employee, tni, selectedJd, selectedNeeds } = args;
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
    if (!printWindow) {
      toast.error("Allow popups to print TNI");
      return;
    }

    const rowsHtml = selectedNeeds
      .map((need, index) => {
        const sop = sops.find((s) => s.id === need.sopId);
        const sopRef = sop ? `${sop.sopNumber}` : "NA";
        const plannedDate = formatDateForPrint(addDays(employee.dateOfJoining, index < 6 ? 1 : 2));
        return `
          <tr>
            <td class="center">${index + 1}</td>
            <td>${need.topic || "—"}</td>
            <td class="center">${sopRef}</td>
            <td class="center">${plannedDate}</td>
            <td></td>
          </tr>
        `;
      })
      .join("");

    const fullName = `${employee.firstName} ${employee.lastName}`.trim();
    const departmentName = employee.departmentName || "—";
    const designation = selectedJd?.title || employee.designation || "—";
    const experience =
      employee.employmentType === "intern" || employee.employmentType === "temporary"
        ? "Fresher"
        : "Experienced";

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>TNI - ${employee.employeeCode}</title>
          <style>
            body {
              margin: 0;
              font-family: "Times New Roman", serif;
              color: #111;
              background: #fff;
            }
            .sheet {
              width: 980px;
              margin: 16px auto;
              border: 1px solid #222;
              padding: 10px 12px;
              box-sizing: border-box;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 8px;
            }
            .header-table td {
              border: 1px solid #666;
              padding: 4px 6px;
              vertical-align: middle;
            }
            .logo-cell {
              width: 96px;
              text-align: center;
            }
            .logo-cell img {
              width: 72px;
              height: auto;
            }
            .title-1, .title-2, .title-3 {
              text-align: center;
              font-weight: 700;
            }
            .title-1 { font-size: 18px; }
            .title-2 { font-size: 16px; }
            .title-3 { font-size: 17px; }
            .meta {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
            }
            .meta td {
              padding: 3px 6px;
              border: none;
              font-size: 14px;
            }
            .meta b {
              margin-right: 6px;
            }
            .grid {
              width: 100%;
              border-collapse: collapse;
            }
            .grid th, .grid td {
              border: 1px solid #333;
              padding: 5px 8px;
              font-size: 13px;
              vertical-align: top;
            }
            .grid th {
              text-align: center;
              font-weight: 700;
            }
            .center {
              text-align: center;
            }
            .footer {
              margin-top: 8px;
              font-size: 16px;
              display: flex;
              justify-content: space-between;
            }
            @media print {
              .sheet {
                width: auto;
                margin: 0;
                border: 0;
                padding: 6mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <table class="header-table">
              <tr>
                <td class="logo-cell" rowspan="3">
                  <img src="/brand/skymap-logo.png" alt="SkyMap logo" />
                </td>
                <td class="title-1">SKYMAP PHARMACEUTICALS PVT. LTD, ROORKEE</td>
              </tr>
              <tr>
                <td class="title-2">QUALITY ASSURANCE</td>
              </tr>
              <tr>
                <td class="title-3">TRAINING NEED IDENTIFICATION FOR NEW JOINEE</td>
              </tr>
            </table>

            <table class="meta">
              <tr>
                <td><b>Employee Name:</b> ${fullName}</td>
                <td><b>Designation:</b> ${designation}</td>
                <td><b>Department:</b> ${departmentName}</td>
              </tr>
              <tr>
                <td><b>Date of Joining:</b> ${formatDateForPrint(employee.dateOfJoining)}</td>
                <td><b>Employee Code:</b> ${employee.employeeCode}</td>
                <td><b>Experience:</b> ${experience}</td>
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
            <div class="footer">
              <span>FORMAT No.: SOP/QA/002/F08-03</span>
              <span>TNI Ref: ${tni.id}</span>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function handleAiSuggest() {
    if (!jobTitle.trim() || responsibilities.trim().length < 10) {
      toast.error("Enter job title and responsibilities first");
      return;
    }
    setBusy(true);
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
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!actor || !profile) return;
    if (!employeeId) {
      toast.error("Select an employee");
      return;
    }
    if (!jdId) {
      toast.error("Create and link a Job Description first");
      return;
    }
    if (!needs.length || needs.some((n) => !n.topic.trim())) {
      toast.error("Add at least one training need with a topic");
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    const dept = emp?.departmentId || jds.find((j) => j.id === jdId)?.departmentId;
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
        needs: needs.map((n) => ({
          id: n.id,
          topic: n.topic.trim(),
          sopId: n.sopId || undefined,
          priority: n.priority,
          rationale: n.rationale.trim(),
          status: "identified" as const,
        })),
      };

      let tni: TrainingNeedIdentification;
      if (editingId) {
        tni = await updateTNI(editingId, payload, profile.uid);
        toast.success(`TNI updated (${tni.id})`);
      } else {
        tni = await createTNI(payload, profile.uid);
        await createTniLifecycle(employeeId, tni.id, actor);
        toast.success(`TNI submitted (${tni.id})`);
      }
      if (emp) {
        const selectedJd = jds.find((j) => j.id === jdId);
        printTniSheet({
          employee: emp,
          tni,
          selectedJd,
          selectedNeeds: needs,
        });
      }
      await loadData();
      setEditingId(null);
      setNeeds([]);
      setEmployeeId("");
      setJdId("");
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
      }))
    );
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this TNI?")) return;
    setBusy(true);
    try {
      await deleteTNI(id);
      toast.success("TNI deleted");
      if (editingId === id) setEditingId(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete TNI");
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
    const linkedJd = jds.find((j) => j.id === record.jdId);
    const savedNeeds: NeedRow[] = record.needs.map((n) => ({
      id: n.id,
      topic: n.topic,
      sopId: n.sopId || "",
      priority: n.priority,
      rationale: n.rationale,
    }));
    printTniSheet({
      employee: emp,
      tni: record,
      selectedJd: linkedJd,
      selectedNeeds: savedNeeds,
    });
  }

  return (
    <RequirePermission permission={["tni:read", "tni:write"]}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Training Need Identification
          </h1>
          <p className="text-muted-foreground">
            Map JD responsibilities to SOP training needs
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>{editingId ? "Edit TNI form" : "TNI form"}</CardTitle>
                <CardDescription>
                  Created by Department Head after JD approval
                </CardDescription>
              </div>
              <Can permission="tni:write">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => void handleAiSuggest()}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {busy ? "Suggesting…" : "Suggest with AI"}
                </Button>
              </Can>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} · {e.employeeCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Linked JD</Label>
                <Select value={jdId} onValueChange={setJdId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select JD" />
                  </SelectTrigger>
                  <SelectContent>
                    {jds
                      .filter((j) => !employeeId || j.employeeId === employeeId)
                      .map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title} ({j.id})
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
                    onClick={() =>
                      setNeeds((n) => n.filter((x) => x.id !== need.id))
                    }
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
                            x.id === need.id
                              ? { ...x, topic: e.target.value }
                              : x
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
                              ? {
                                  ...x,
                                  priority: v as NeedRow["priority"],
                                }
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
                            x.id === need.id
                              ? { ...x, rationale: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={addNeed}>
                <Plus className="mr-2 h-4 w-4" />
                Add need
              </Button>
              <Can permission="tni:write">
                <Button disabled={busy} onClick={() => void handleSubmit()}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Update TNI" : "Submit TNI"}
                </Button>
              </Can>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setNeeds([]);
                    setEmployeeId("");
                    setJdId("");
                    setJobTitle("");
                    setResponsibilities("");
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved TNIs</CardTitle>
            <CardDescription>
              View, edit, delete and print submitted TNI records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground">No TNI records yet.</p>
            ) : (
              records.map((record) => {
                const emp = employees.find((e) => e.id === record.employeeId);
                const linkedJd = jds.find((j) => j.id === record.jdId);
                return (
                  <div
                    key={record.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        {emp
                          ? `${emp.firstName} ${emp.lastName} · ${emp.employeeCode}`
                          : record.employeeId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        JD: {linkedJd?.title || record.jdId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Needs: {record.needs.length} · Status: {record.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintSaved(record)}
                      >
                        <Printer className="mr-1 h-3.5 w-3.5" />
                        Print
                      </Button>
                      <Can permission="tni:write">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(record)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </Can>
                      <Can permission="tni:write">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDelete(record.id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </Can>
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
