"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Printer, Sparkles } from "lucide-react";
import { draftJdWithAi } from "@/lib/services/ai";
import {
  createJobDescription,
  deleteJobDescription,
  listJobDescriptions,
  updateJobDescription,
} from "@/lib/services/training";
import {
  createJdLifecycle,
  listEmployeesForLifecycle,
  type LifecycleActor,
} from "@/lib/services/lifecycle";
import { listDepartments, departmentLabel } from "@/lib/services/departments";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { printHtml } from "@/lib/print";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department, Employee, JobDescription, UserRole } from "@/types";

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

export default function JdPage() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [supersedesNo, setSupersedesNo] = useState("");
  const [records, setRecords] = useState<JobDescription[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
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
    const [emps, depts, jdRows] = await Promise.all([
      listEmployeesForLifecycle(),
      listDepartments(),
      listJobDescriptions(),
    ]);
    setEmployees(emps);
    setDepartments(depts);
    setRecords(jdRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    if (emp.departmentId) setDepartmentId(emp.departmentId);
    if (!jobTitle && emp.designation) setJobTitle(emp.designation);
  }, [employeeId, employees, jobTitle]);

  async function handleAiDraft() {
    if (!jobTitle.trim()) {
      toast.error("Enter a job title first");
      return;
    }
    setBusy(true);
    try {
      const { draft, model } = await draftJdWithAi({
        jobTitle: jobTitle.trim(),
        department: departmentLabel(departments, departmentId) || undefined,
      });
      setResponsibilities(
        draft.responsibilities.map((r, i) => `${i + 1}. ${r}`).join("\n")
      );
      setQualifications(draft.qualifications.join("\n"));
      setSkills(draft.skills.join(", "));
      toast.success(`JD draft filled (${model}) — review before saving`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI draft failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!actor || !profile) return;
    if (!employeeId) {
      toast.error("Select an employee");
      return;
    }
    if (!jobTitle.trim()) {
      toast.error("Job title required");
      return;
    }
    const dept =
      departmentId ||
      employees.find((x) => x.id === employeeId)?.departmentId ||
      "";
    if (!dept) {
      toast.error("Department required — handover employee first");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        employeeId,
        departmentId: dept,
        title: jobTitle.trim(),
        responsibilities: responsibilities
          .split("\n")
          .map((l) => l.replace(/^\d+\.\s*/, "").trim())
          .filter(Boolean),
        qualifications: qualifications
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        experience: experience.trim(),
        supersedesNo: supersedesNo.trim(),
        effectiveFrom: new Date(effectiveFrom).toISOString(),
      };

      if (editingId) {
        await updateJobDescription(editingId, payload, profile.uid);
        toast.success("Job Description updated");
      } else {
        const jd = await createJobDescription(payload, profile.uid);
        await createJdLifecycle(employeeId, jd.id, actor);
        toast.success(`Job Description saved (${jd.id})`);
      }

      await loadData();
      setEditingId(null);
      setJobTitle("");
      setResponsibilities("");
      setQualifications("");
      setSkills("");
      setExperience("");
      setSupersedesNo("");
      setEmployeeId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save JD");
    } finally {
      setBusy(false);
    }
  }

  const eligible = employees.filter((e) =>
    ["department_handover", "jd_created", "induction_completed", "tni_created"].includes(
      e.lifecycleStage
    ) || !e.jdId
  );

  function handleEdit(record: JobDescription) {
    setEditingId(record.id);
    setEmployeeId(record.employeeId);
    setDepartmentId(record.departmentId);
    setJobTitle(record.title);
    setResponsibilities(record.responsibilities.map((r, i) => `${i + 1}. ${r}`).join("\n"));
    setQualifications(record.qualifications.join("\n"));
    setSkills(record.skills.join(", "));
    setExperience(record.experience || "");
    setSupersedesNo(record.supersedesNo || "");
    setEffectiveFrom(record.effectiveFrom.slice(0, 10));
  }

  async function handleDelete(id: string) {
    await deleteJobDescription(id);
    if (editingId === id) setEditingId(null);
    await loadData();
  }

  function handlePrint(record: JobDescription) {
    const emp = employees.find((e) => e.id === record.employeeId);
    const deptName =
      emp?.departmentName ||
      departmentLabel(departments, record.departmentId) ||
      "—";
    const fullName = emp
      ? `${emp.firstName} ${emp.lastName}`.trim()
      : record.employeeId;
    const employeeCode = emp?.employeeCode || "—";
    const joiningDate = formatDate(emp?.dateOfJoining);
    const effectiveDate = formatDate(record.effectiveFrom);
    const qualification =
      record.qualifications.filter(Boolean).join(", ") || "—";
    const experience = record.experience?.trim() || "—";
    const reportingTo =
      record.reportingTo || emp?.reportingManagerName || "—";
    const revisionNo = String(record.version || 1);
    const supersedesNo =
      record.supersedesNo?.trim() ||
      (record.version && record.version > 1 ? String(record.version - 1) : "—");
    const jdNo = record.id.toUpperCase();
    const logoUrl = `${window.location.origin}/brand/skymap-logo.png`;

    const responsibilityRows = (record.responsibilities.length
      ? record.responsibilities
      : ["—"]
    )
      .map(
        (item, index) => `
        <tr>
          <td class="center">${index + 1}.</td>
          <td>${item}</td>
        </tr>`
      )
      .join("");

    const headerBlock = `
      <table class="header-table">
        <tr>
          <td class="logo-cell" rowspan="3">
            <img src="${logoUrl}" alt="SkyMap logo" />
          </td>
          <td class="title-1">SKYMAP PHARMACEUTICALS PVT. LTD, ROORKEE</td>
        </tr>
        <tr>
          <td class="title-2">QUALITY ASSURANCE</td>
        </tr>
        <tr>
          <td class="title-3">JOB DESCRIPTION</td>
        </tr>
      </table>
    `;

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>JD - ${employeeCode}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #111;
              font-family: "Times New Roman", Times, serif;
              background: #fff;
            }
            .page {
              width: 100%;
              min-height: 250mm;
              border: 3px double #222;
              padding: 8px;
              page-break-after: always;
            }
            .page:last-child { page-break-after: auto; }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 8px;
            }
            .header-table td {
              border: 1px solid #333;
              padding: 4px 6px;
              vertical-align: middle;
            }
            .logo-cell {
              width: 90px;
              text-align: center;
            }
            .logo-cell img {
              width: 70px;
              height: auto;
            }
            .title-1, .title-2, .title-3 {
              text-align: center;
              font-weight: 700;
              letter-spacing: 0.2px;
            }
            .title-1 { font-size: 16px; }
            .title-2 { font-size: 15px; }
            .title-3 { font-size: 16px; }
            .info-table, .resp-table, .sign-table {
              width: 100%;
              border-collapse: collapse;
            }
            .info-table td, .resp-table th, .resp-table td, .sign-table td {
              border: 1px solid #333;
              padding: 5px 7px;
              vertical-align: top;
              font-size: 13px;
            }
            .info-table .label {
              font-weight: 700;
              width: 22%;
              white-space: nowrap;
            }
            .info-table .value {
              width: 28%;
            }
            .intro {
              margin: 10px 0;
              font-size: 13px;
              line-height: 1.45;
              text-align: justify;
            }
            .resp-table th {
              text-align: center;
              font-weight: 700;
              background: #f3f3f3;
            }
            .resp-table td.center,
            .center {
              text-align: center;
              width: 70px;
            }
            .handover, .ack {
              margin-top: 12px;
              font-size: 13px;
              line-height: 1.7;
            }
            .line {
              display: inline-block;
              min-width: 220px;
              border-bottom: 1px solid #333;
              margin: 0 4px;
            }
            .sign-table td {
              height: 180px;
              width: 50%;
              font-size: 13px;
            }
            .sign-title {
              font-weight: 700;
              margin-bottom: 50px;
            }
            .sign-meta {
              margin-top: 24px;
              line-height: 1.8;
            }
            @media print {
              .page {
                min-height: auto;
                border-width: 2px;
              }
            }
          </style>
        </head>
        <body>
          <div class="page">
            ${headerBlock}

            <table class="info-table">
              <tr>
                <td class="label">Name of Employee</td>
                <td class="value">${fullName}</td>
                <td class="label">JD No.</td>
                <td class="value">${jdNo}</td>
              </tr>
              <tr>
                <td class="label">Department</td>
                <td class="value">${deptName}</td>
                <td class="label">Employee Code</td>
                <td class="value">${employeeCode}</td>
              </tr>
              <tr>
                <td class="label">Designation</td>
                <td class="value">${record.title || "—"}</td>
                <td class="label">Date of Joining</td>
                <td class="value">${joiningDate}</td>
              </tr>
              <tr>
                <td class="label">Qualification</td>
                <td class="value">${qualification}</td>
                <td class="label">Experience</td>
                <td class="value">${experience}</td>
              </tr>
              <tr>
                <td class="label">Revision Number</td>
                <td class="value">${revisionNo}</td>
                <td class="label">Supersedes No.</td>
                <td class="value">${supersedesNo}</td>
              </tr>
              <tr>
                <td class="label">Effective Date of JD</td>
                <td class="value">${effectiveDate}</td>
                <td class="label">Reporting To</td>
                <td class="value">${reportingTo}</td>
              </tr>
            </table>

            <p class="intro">
              Your job responsibilities are listed below for your understanding and acceptance.
              In case of any system up-gradation in future, you will be simultaneously re-trained
              to understand the new implementation.
            </p>

            <table class="resp-table">
              <thead>
                <tr>
                  <th style="width:12%">Sr. No.</th>
                  <th>Responsible for</th>
                </tr>
              </thead>
              <tbody>
                ${responsibilityRows}
              </tbody>
            </table>

            <p class="handover">
              In case of your absence; hand over your responsibility to
              <span class="line">&nbsp;</span>
              with intimation to the assignee.
            </p>
            <p class="ack">
              Acknowledged by: <span class="line">&nbsp;</span>
            </p>
          </div>

          <div class="page">
            ${headerBlock}
            <table class="sign-table">
              <tr>
                <td>
                  <div class="sign-title">Job Responsibility Assigned by:</div>
                  <div class="sign-meta">(Name, Sign and Date)</div>
                  <div class="sign-meta">Designation: <span class="line">&nbsp;</span></div>
                </td>
                <td>
                  <div class="sign-title">Job Responsibility Accepted by:</div>
                  <div class="sign-meta">(Name, Sign and Date)</div>
                  <div class="sign-meta">Designation: <span class="line">&nbsp;</span></div>
                </td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;

    try {
      printHtml(html, `JD - ${employeeCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open print dialog");
    }
  }

  return (
    <RequirePermission permission={["jd:read", "jd:write"]}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Description</h1>
          <p className="text-muted-foreground">
            Department Head creates JD after handover
          </p>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>{editingId ? "Edit JD" : "Create / update JD"}</CardTitle>
                <CardDescription>
                  Linked to employee after induction handover
                </CardDescription>
              </div>
              <Can permission="jd:write">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => void handleAiDraft()}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {busy ? "Drafting…" : "Draft with AI"}
                </Button>
              </Can>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void handleSave(e)}>
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {(eligible.length ? eligible : employees).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} · {e.employeeCode}
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
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsibilities (one per line)</Label>
                <Textarea
                  rows={5}
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Qualifications</Label>
                <Textarea
                  rows={3}
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Experience</Label>
                <Textarea
                  rows={2}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g. 2 years in QA / Fresher"
                />
              </div>
              <div className="space-y-2">
                <Label>Skills (comma separated)</Label>
                <Textarea
                  rows={2}
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Supersedes No.</Label>
                <Input
                  value={supersedesNo}
                  onChange={(e) => setSupersedesNo(e.target.value)}
                  placeholder="e.g. JD-001 / —"
                />
              </div>
              <div className="space-y-2">
                <Label>Effective from</Label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>
              <Can permission="jd:write">
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Update JD" : "Save JD"}
                </Button>
              </Can>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setJobTitle("");
                    setResponsibilities("");
                    setQualifications("");
                    setSkills("");
                    setExperience("");
                    setSupersedesNo("");
                    setEmployeeId("");
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved Job Descriptions</CardTitle>
            <CardDescription>
              View, edit, delete and print previously created JD records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground">No JD records yet.</p>
            ) : (
              records.map((record) => {
                const emp = employees.find((e) => e.id === record.employeeId);
                return (
                  <div
                    key={record.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{record.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp
                          ? `${emp.firstName} ${emp.lastName} · ${emp.employeeCode}`
                          : record.employeeId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Effective: {formatDate(record.effectiveFrom)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => handlePrint(record)}>
                        <Printer className="mr-1 h-3.5 w-3.5" />
                        Print
                      </Button>
                      <Can permission="jd:write">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(record)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </Can>
                      <AdminDeleteButton
                        label="Delete"
                        size="sm"
                        variant="destructive"
                        confirmTitle="Delete this Job Description?"
                        confirmDescription="Only Super Admin can delete JD records. This cannot be undone."
                        successMessage="Job Description deleted"
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
