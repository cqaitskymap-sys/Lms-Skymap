"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, Loader2, Pencil, Printer, Sparkles } from "lucide-react";
import { draftJdWithAi } from "@/lib/services/ai";
import {
  approveJobDescription,
  createJobDescription,
  deleteJobDescription,
  listJobDescriptions,
  updateJobDescription,
} from "@/lib/services/training";
import {
  approveJdHandoverAssignment,
  fetchMyJdSignoffs,
  type JdPendingSignoffRow,
} from "@/lib/services/jd-handover";
import { resolveLinkedUserUid } from "@/lib/services/notifications";
import { sameJdSignoffPerson } from "@/lib/jd/absence-handover";
import { JdHandoverPendingCard } from "@/components/jd/jd-handover-pending";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";
import {
  createJdLifecycle,
  listEmployeesForLifecycle,
  type LifecycleActor,
} from "@/lib/services/lifecycle";
import { getEmployee } from "@/lib/services/employees";
import { listDepartments, departmentLabel } from "@/lib/services/departments";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { escapeHtml, printHtml } from "@/lib/print";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/rbac/permissions";
import type { Department, Employee, JobDescription, JdSignoff, UserRole } from "@/types";

const SELF_ASSIGNER = "__self__";

const POST_HANDOVER_STAGES = [
  "department_handover",
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

function employeeFullName(emp?: Employee | null): string {
  if (!emp) return "";
  return `${emp.firstName} ${emp.lastName}`.trim();
}

function mergeJdRecords(...lists: JobDescription[][]): JobDescription[] {
  const byId = new Map<string, JobDescription>();
  for (const list of lists) {
    for (const row of list) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

function statusBadgeVariant(status: JobDescription["status"]) {
  if (status === "approved") return "default" as const;
  if (status === "obsolete") return "secondary" as const;
  return "outline" as const;
}

function JdPageInner() {
  const searchParams = useSearchParams();
  const employeeFromUrl = searchParams.get("employee") || "";
  const acknowledgeFromUrl = searchParams.get("acknowledge") || "";
  const { profile, can } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [handoverEmployeeId, setHandoverEmployeeId] = useState("");
  const [assignedByEmployeeId, setAssignedByEmployeeId] = useState("");
  const [acceptedByEmployeeId, setAcceptedByEmployeeId] = useState("");
  const [jdNo, setJdNo] = useState("");
  const [revisionNo, setRevisionNo] = useState("1");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [experience, setExperience] = useState("");
  const [supersedesNo, setSupersedesNo] = useState("");
  const [records, setRecords] = useState<JobDescription[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [myPendingSignoffs, setMyPendingSignoffs] = useState<JdPendingSignoffRow[]>([]);

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
      const pack = profile?.uid
        ? await fetchMyJdSignoffs({
            uid: profile.uid,
            employeeId: profile.employeeId,
          }).catch(() => ({ items: [] as JobDescription[], pending: [] as JdPendingSignoffRow[] }))
        : { items: [] as JobDescription[], pending: [] as JdPendingSignoffRow[] };
      const assigned = pack.items;
      setAssignedIds(new Set(assigned.map((row) => row.id)));
      setMyPendingSignoffs(pack.pending);

      const isEmployee = profile?.role === "employee";
      const myEmployeeId = profile?.employeeId;

      if (isEmployee) {
        const depts = await listDepartments().catch(() => [] as Department[]);
        setDepartments(depts.filter((d) => d.isActive));
        if (!myEmployeeId) {
          setEmployees([]);
          setRecords(assigned);
          return;
        }
        const [ownRows, self] = await Promise.all([
          listJobDescriptions({ employeeId: myEmployeeId }),
          getEmployee(myEmployeeId).catch(() => null),
        ]);
        const jdRows = mergeJdRecords(ownRows, assigned);
        const extraIds = [
          ...new Set(
            assigned
              .map((row) => row.employeeId)
              .filter((id) => id && id !== myEmployeeId)
          ),
        ];
        const extras = (
          await Promise.all(extraIds.map((id) => getEmployee(id).catch(() => null)))
        ).filter((row): row is Employee => Boolean(row));
        setEmployees(self ? [self, ...extras.filter((e) => e.id !== self.id)] : extras);
        setRecords(jdRows);
        return;
      }

      const [emps, depts, jdRows] = await Promise.all([
        listEmployeesForLifecycle(),
        listDepartments(),
        listJobDescriptions(),
      ]);
      setEmployees(emps);
      setDepartments(depts.filter((d) => d.isActive));
      setRecords(mergeJdRecords(jdRows, assigned));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load JD data");
      setEmployees([]);
      setDepartments([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.employeeId, profile?.uid]);

  useEffect(() => {
    void loadData();
    const onUpdate = () => void loadData();
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => {
      window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
    };
  }, [loadData]);

  useEffect(() => {
    if (employeeFromUrl) setEmployeeId(employeeFromUrl);
  }, [employeeFromUrl]);

  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    if (emp.departmentId) setDepartmentId(emp.departmentId);
    if (!jobTitle && emp.designation) setJobTitle(emp.designation);
  }, [employeeId, employees, jobTitle]);

  const scopedEmployees = useMemo(() => {
    if (employeeScopeId) {
      return employees.filter((e) => e.id === employeeScopeId);
    }
    if (deptScopeId) {
      return employees.filter((e) => e.departmentId === deptScopeId);
    }
    return employees;
  }, [employees, deptScopeId, employeeScopeId]);

  const employeesWithJd = useMemo(
    () => new Set(records.filter((r) => r.status !== "obsolete").map((r) => r.employeeId)),
    [records]
  );

  const eligible = useMemo(
    () =>
      scopedEmployees.filter(
        (e) =>
          POST_HANDOVER_STAGES.includes(
            e.lifecycleStage as (typeof POST_HANDOVER_STAGES)[number]
          ) &&
          !employeesWithJd.has(e.id) &&
          !e.jdId
      ),
    [scopedEmployees, employeesWithJd]
  );

  const visibleRecords = useMemo(() => {
    let rows = records;
    if (employeeScopeId) {
      rows = rows.filter(
        (r) =>
          r.employeeId === employeeScopeId ||
          r.absenceHandoverEmployeeId === employeeScopeId ||
          r.assignedBy?.employeeId === employeeScopeId ||
          r.acceptedBy?.employeeId === employeeScopeId ||
          assignedIds.has(r.id)
      );
    } else if (deptScopeId) {
      rows = rows.filter((r) => r.departmentId === deptScopeId || assignedIds.has(r.id));
    }
    return rows;
  }, [records, deptScopeId, employeeScopeId, assignedIds]);

  const handoverCandidates = useMemo(
    () =>
      scopedEmployees.filter(
        (e) =>
          e.id !== employeeId &&
          e.status !== "inactive" &&
          e.status !== "terminated"
      ),
    [scopedEmployees, employeeId]
  );

  const selectedHandover = useMemo(
    () => employees.find((e) => e.id === handoverEmployeeId) || null,
    [employees, handoverEmployeeId]
  );

  const selectedAssigned = useMemo(
    () =>
      assignedByEmployeeId && assignedByEmployeeId !== SELF_ASSIGNER
        ? employees.find((e) => e.id === assignedByEmployeeId) || null
        : null,
    [employees, assignedByEmployeeId]
  );

  const selectedAccepted = useMemo(
    () => employees.find((e) => e.id === acceptedByEmployeeId) || null,
    [employees, acceptedByEmployeeId]
  );

  const signoffCandidates = useMemo(
    () =>
      scopedEmployees.filter((e) => e.status !== "inactive" && e.status !== "terminated"),
    [scopedEmployees]
  );

  useEffect(() => {
    if (editingId) return;
    if (employeeId) setAcceptedByEmployeeId(employeeId);
  }, [employeeId, editingId]);

  useEffect(() => {
    if (!acknowledgeFromUrl) return;
    const node = document.getElementById(`jd-${acknowledgeFromUrl}`);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [acknowledgeFromUrl, visibleRecords]);

  function resetForm() {
    setEditingId(null);
    setJdNo("");
    setRevisionNo("1");
    setJobTitle("");
    setDepartmentId("");
    setResponsibilities("");
    setQualifications("");
    setExperience("");
    setSupersedesNo("");
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setEmployeeId("");
    setHandoverEmployeeId("");
    setAssignedByEmployeeId("");
    setAcceptedByEmployeeId("");
  }

  async function handleAiDraft() {
    if (!jobTitle.trim()) {
      toast.error("Enter a job title first");
      return;
    }
    setAiBusy(true);
    try {
      const { draft, model } = await draftJdWithAi({
        jobTitle: jobTitle.trim(),
        department: departmentLabel(departments, departmentId) || undefined,
      });
      setResponsibilities(
        draft.responsibilities.map((r, i) => `${i + 1}. ${r}`).join("\n")
      );
      setQualifications(draft.qualifications.join("\n"));
      toast.success(`JD draft filled (${model}) — review before saving`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI draft failed");
    } finally {
      setAiBusy(false);
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
    if (!jdNo.trim()) {
      toast.error("JD no. required");
      return;
    }
    const revision = Number(revisionNo);
    if (!Number.isInteger(revision) || revision < 0) {
      toast.error("Revision no. must be a whole number");
      return;
    }
    const parsedResp = responsibilities
      .split("\n")
      .map((l) => l.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);
    if (!parsedResp.length) {
      toast.error("Add at least one responsibility");
      return;
    }
    const effectiveParsed = new Date(effectiveFrom);
    if (Number.isNaN(effectiveParsed.getTime())) {
      toast.error("Enter a valid effective date");
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
    const handoverEmp = employees.find((x) => x.id === handoverEmployeeId);
    if (!handoverEmp) {
      toast.error("Select who will take over in case of absence");
      return;
    }
    if (handoverEmp.id === employeeId) {
      toast.error("Absence handover person must be someone else");
      return;
    }
    const assignedIsSelfEarly = assignedByEmployeeId === SELF_ASSIGNER;
    const sameAssignAndAccept =
      acceptedByEmployeeId ===
      (assignedIsSelfEarly ? profile.employeeId || "" : assignedByEmployeeId);
    const acceptedIsCurrentUser =
      assignedIsSelfEarly &&
      employees.some((e) => e.id === acceptedByEmployeeId && e.userId === profile.uid);
    if (
      (sameAssignAndAccept && acceptedByEmployeeId) ||
      acceptedIsCurrentUser
    ) {
      toast.error("Assigned by and Accepted by must be different people");
      return;
    }
    const handoverName = employeeFullName(handoverEmp);
    if (!handoverName) {
      toast.error("Selected handover person has no name");
      return;
    }

    const assignedIsSelf = assignedByEmployeeId === SELF_ASSIGNER;
    const assignedEmp = assignedIsSelf
      ? null
      : employees.find((x) => x.id === assignedByEmployeeId);
    if (!assignedIsSelf && !assignedEmp) {
      toast.error("Select who assigns the job responsibility");
      return;
    }
    const acceptedEmp = employees.find((x) => x.id === acceptedByEmployeeId);
    if (!acceptedEmp) {
      toast.error("Select who accepts the job responsibility");
      return;
    }

    setBusy(true);
    try {
      const handoverUid =
        handoverEmp.userId || (await resolveLinkedUserUid(handoverEmp.id));
      const assignedUid = assignedIsSelf
        ? profile.uid
        : assignedEmp?.userId ||
          (assignedEmp ? await resolveLinkedUserUid(assignedEmp.id) : undefined);
      const acceptedUid =
        acceptedEmp.userId || (await resolveLinkedUserUid(acceptedEmp.id));

      const assignedName = assignedIsSelf
        ? (profile.displayName || "").trim() || "Current user"
        : employeeFullName(assignedEmp);
      const assignedBy: JdSignoff = assignedIsSelf
        ? {
            userId: profile.uid,
            name: assignedName,
            ...(profile.employeeId ? { employeeId: profile.employeeId } : {}),
            designation: ROLE_LABELS[profile.role] || profile.role,
            status: "pending",
          }
        : {
            employeeId: assignedEmp!.id,
            name: assignedName,
            designation: assignedEmp!.designation,
            ...(assignedUid ? { userId: assignedUid } : {}),
            status: "pending",
          };
      const acceptedBy: JdSignoff = {
        employeeId: acceptedEmp.id,
        name: employeeFullName(acceptedEmp),
        designation: acceptedEmp.designation,
        ...(acceptedUid ? { userId: acceptedUid } : {}),
        status: "pending",
      };

      const payload = {
        employeeId,
        departmentId: dept,
        jdNo: jdNo.trim(),
        title: jobTitle.trim(),
        version: revision,
        responsibilities: parsedResp,
        qualifications: qualifications
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        skills: [] as string[],
        experience: experience.trim(),
        supersedesNo: supersedesNo.trim(),
        effectiveFrom: effectiveParsed.toISOString(),
        absenceHandoverEmployeeId: handoverEmp.id,
        absenceHandoverName: handoverName,
        ...(handoverUid ? { absenceHandoverUserId: handoverUid } : {}),
        assignedBy,
        acceptedBy,
      };

      const previous = editingId ? records.find((r) => r.id === editingId) : undefined;
      const acceptedName = employeeFullName(acceptedEmp);
      const willNotify: string[] = [];
      const missingLogin: string[] = [];
      const notifyIfChanged = (
        changed: boolean,
        name: string,
        hasUid: boolean
      ) => {
        if (!changed || !name) return;
        if (hasUid) willNotify.push(name);
        else missingLogin.push(name);
      };
      notifyIfChanged(
        !previous || previous.absenceHandoverEmployeeId !== handoverEmp.id,
        handoverName,
        Boolean(handoverUid)
      );
      notifyIfChanged(
        !previous || !sameJdSignoffPerson(previous.assignedBy, assignedBy),
        assignedName,
        Boolean(assignedUid)
      );
      notifyIfChanged(
        !previous || !sameJdSignoffPerson(previous.acceptedBy, acceptedBy),
        acceptedName,
        Boolean(acceptedUid)
      );
      const uniqueNotified = [...new Set(willNotify)];
      const uniqueMissing = [...new Set(missingLogin)];

      if (editingId) {
        const { skills: _ignoredSkills, ...updatePayload } = payload;
        void _ignoredSkills;
        await updateJobDescription(editingId, updatePayload, profile.uid);
        toast.success(
          uniqueNotified.length
            ? `Job Description updated · notified ${uniqueNotified.join(", ")}`
            : "Job Description updated"
        );
      } else {
        const jd = await createJobDescription(payload, profile.uid);
        await createJdLifecycle(employeeId, jd.id, actor);
        toast.success(
          uniqueNotified.length
            ? `Job Description saved · notified ${uniqueNotified.join(", ")}`
            : `Job Description saved (${jd.id})`
        );
      }
      for (const name of uniqueMissing) {
        toast.warning(
          `${name} has no login account, so a notification could not be sent`
        );
      }

      await loadData();
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save JD");
    } finally {
      setBusy(false);
    }
  }

  function handleEdit(record: JobDescription) {
    setEditingId(record.id);
    setEmployeeId(record.employeeId);
    setDepartmentId(record.departmentId);
    setJdNo(record.jdNo || "");
    setRevisionNo(String(record.version ?? 1));
    setJobTitle(record.title);
    setResponsibilities(record.responsibilities.map((r, i) => `${i + 1}. ${r}`).join("\n"));
    setQualifications(record.qualifications.join("\n"));
    setExperience(record.experience || "");
    setSupersedesNo(record.supersedesNo || "");
    setEffectiveFrom(record.effectiveFrom.slice(0, 10));
    setHandoverEmployeeId(record.absenceHandoverEmployeeId || "");
    setAssignedByEmployeeId(
      record.assignedBy?.userId && profile?.uid === record.assignedBy.userId
        ? SELF_ASSIGNER
        : record.assignedBy?.employeeId || ""
    );
    setAcceptedByEmployeeId(record.acceptedBy?.employeeId || record.employeeId);
  }

  async function handleDelete(id: string) {
    try {
      await deleteJobDescription(id);
      if (editingId === id) resetForm();
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  async function handleApprove(record: JobDescription) {
    if (!profile) return;
    setBusy(true);
    try {
      await approveJobDescription(record.id, profile.uid);
      toast.success("Job Description approved");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleAcknowledgeHandover(
    record: JobDescription,
    slot: "absence_handover" | "assigned_by" | "accepted_by" = "absence_handover"
  ) {
    if (!profile) return;
    setBusy(true);
    try {
      await approveJdHandoverAssignment(
        record.id,
        {
          uid: profile.uid,
          name: profile.displayName,
          employeeId: profile.employeeId,
        },
        slot
      );
      toast.success(
        slot === "accepted_by"
          ? "Accepted — electronically computer-generated signature added"
          : "Approved — electronically computer-generated signature added"
      );
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusy(false);
    }
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
    const experienceText = record.experience?.trim() || "—";
    const reportingTo =
      record.reportingTo || emp?.reportingManagerName || "—";
    const revisionNo = String(record.version ?? 1);
    const supersedes =
      record.supersedesNo?.trim() ||
      (record.version && record.version > 1 ? String(record.version - 1) : "—");
    const jdNo = (record.jdNo || record.id).toUpperCase();
    const logoUrl = `${window.location.origin}/brand/skymap-logo.png`;
    const handoverName = record.absenceHandoverName?.trim() || "";
    const handoverAcked = record.absenceHandoverStatus === "acknowledged";
    const ackName =
      record.absenceHandoverAcknowledgedByName?.trim() || handoverName;
    const ackStamp = record.absenceHandoverAcknowledgedAt
      ? formatDate(record.absenceHandoverAcknowledgedAt)
      : "";

    const printSignCell = (title: string, signoff?: JdSignoff) => {
      const signed =
        signoff?.status === "acknowledged" &&
        (signoff.acknowledgedByName || signoff.name);
      const name = (signoff?.acknowledgedByName || signoff?.name || "").trim();
      const stamp = signoff?.acknowledgedAt ? formatDate(signoff.acknowledgedAt) : "";
      const designation = signoff?.designation?.trim() || "";
      if (signed && name) {
        return `
          <div class="sign-title">${title}</div>
          <div class="sign-esign">${escapeHtml(name)}</div>
          <div class="sign-note">Electronically computer-generated signature</div>
          ${stamp ? `<div class="sign-note">${escapeHtml(stamp)}</div>` : ""}
          <div class="sign-meta">Designation: ${
            designation
              ? `<span class="filled-name">${escapeHtml(designation)}</span>`
              : `<span class="line">&nbsp;</span>`
          }</div>
        `;
      }
      return `
        <div class="sign-title">${title}</div>
        <div class="sign-meta">(Name, Sign and Date)</div>
        ${signoff?.name ? `<div class="sign-meta">${escapeHtml(signoff.name)}</div>` : ""}
        <div class="sign-meta">Designation: ${
          designation
            ? `<span class="filled-name">${escapeHtml(designation)}</span>`
            : `<span class="line">&nbsp;</span>`
        }</div>
      `;
    };

    const responsibilityRows = (record.responsibilities.length
      ? record.responsibilities
      : ["—"]
    )
      .map(
        (item, index) => `
        <tr>
          <td class="center">${index + 1}.</td>
          <td>${escapeHtml(item)}</td>
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
          <td class="title-2">${escapeHtml(deptName.toUpperCase())}</td>
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
          <title>JD - ${escapeHtml(employeeCode)}</title>
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
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            .header-table td { border: 1px solid #333; padding: 4px 6px; vertical-align: middle; }
            .logo-cell { width: 90px; text-align: center; }
            .logo-cell img { width: 70px; height: auto; }
            .title-1, .title-2, .title-3 { text-align: center; font-weight: 700; letter-spacing: 0.2px; }
            .title-1 { font-size: 16px; }
            .title-2 { font-size: 15px; }
            .title-3 { font-size: 16px; }
            .info-table, .resp-table, .sign-table { width: 100%; border-collapse: collapse; }
            .info-table td, .resp-table th, .resp-table td, .sign-table td {
              border: 1px solid #333;
              padding: 5px 7px;
              vertical-align: top;
              font-size: 13px;
            }
            .info-table .label { font-weight: 700; width: 22%; white-space: nowrap; }
            .info-table .value { width: 28%; }
            .intro { margin: 10px 0; font-size: 13px; line-height: 1.45; text-align: justify; }
            .resp-table th { text-align: center; font-weight: 700; background: #f3f3f3; }
            .center { text-align: center; width: 70px; }
            .handover, .ack { margin-top: 12px; font-size: 13px; line-height: 1.7; }
            .line { display: inline-block; min-width: 220px; border-bottom: 1px solid #333; margin: 0 4px; }
            .filled-name {
              display: inline-block;
              min-width: 220px;
              border-bottom: 1px solid #333;
              margin: 0 4px;
              padding: 0 4px;
              font-weight: 700;
              text-align: center;
            }
            .esign-block { display: inline-block; vertical-align: top; margin-left: 8px; }
            .esign {
              display: block;
              font-family: "Segoe Script", "Lucida Handwriting", "Brush Script MT", cursive;
              font-size: 18px;
              line-height: 1.2;
              color: #1a365d;
            }
            .esign-note { display: block; font-size: 10px; font-style: italic; color: #444; }
            .esign-date { display: block; font-size: 11px; color: #222; }
            .sign-table td { height: 180px; width: 50%; font-size: 13px; }
            .sign-title { font-weight: 700; margin-bottom: 12px; }
            .sign-meta { margin-top: 16px; line-height: 1.8; }
            .sign-esign {
              font-family: "Segoe Script", "Lucida Handwriting", "Brush Script MT", cursive;
              font-size: 18px;
              color: #1a365d;
              margin: 18px 0 4px;
            }
            .sign-note { font-size: 10px; font-style: italic; color: #444; }
          </style>
        </head>
        <body>
          <div class="page">
            ${headerBlock}
            <table class="info-table">
              <tr>
                <td class="label">Name of Employee</td>
                <td class="value">${escapeHtml(fullName)}</td>
                <td class="label">JD No.</td>
                <td class="value">${escapeHtml(jdNo)}</td>
              </tr>
              <tr>
                <td class="label">Department</td>
                <td class="value">${escapeHtml(deptName)}</td>
                <td class="label">Employee Code</td>
                <td class="value">${escapeHtml(employeeCode)}</td>
              </tr>
              <tr>
                <td class="label">Designation</td>
                <td class="value">${escapeHtml(record.title || "—")}</td>
                <td class="label">Date of Joining</td>
                <td class="value">${escapeHtml(joiningDate)}</td>
              </tr>
              <tr>
                <td class="label">Qualification</td>
                <td class="value">${escapeHtml(qualification)}</td>
                <td class="label">Experience</td>
                <td class="value">${escapeHtml(experienceText)}</td>
              </tr>
              <tr>
                <td class="label">Revision Number</td>
                <td class="value">${escapeHtml(revisionNo)}</td>
                <td class="label">Supersedes No.</td>
                <td class="value">${escapeHtml(supersedes)}</td>
              </tr>
              <tr>
                <td class="label">Effective Date of JD</td>
                <td class="value">${escapeHtml(effectiveDate)}</td>
                <td class="label">Reporting To</td>
                <td class="value">${escapeHtml(reportingTo)}</td>
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
              <tbody>${responsibilityRows}</tbody>
            </table>
            <p class="handover">
              In case of your absence; hand over your responsibility to
              ${
                handoverName
                  ? `<span class="filled-name">${escapeHtml(handoverName)}</span>`
                  : `<span class="line">&nbsp;</span>`
              }
              with intimation to the assignee.
            </p>
            <p class="ack">
              Acknowledged by:
              ${
                handoverAcked && ackName
                  ? `<span class="esign-block">
                      <span class="esign">${escapeHtml(ackName)}</span>
                      <span class="esign-note">Electronically computer-generated signature</span>
                      ${ackStamp ? `<span class="esign-date">${escapeHtml(ackStamp)}</span>` : ""}
                    </span>`
                  : `<span class="line">&nbsp;</span>`
              }
            </p>
          </div>
          <div class="page">
            ${headerBlock}
            <table class="sign-table">
              <tr>
                <td>
                  ${printSignCell("Job Responsibility Assigned by:", record.assignedBy)}
                </td>
                <td>
                  ${printSignCell("Job Responsibility Accepted by:", record.acceptedBy)}
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

  const canWrite = can("jd:write");
  const canApprove = can("jd:approve");

  return (
    <RequirePermission permission="jd:read">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Description</h1>
          <p className="text-muted-foreground">
            Department Head creates JD after handover
            {deptScopeId && ` · ${departmentLabel(departments, deptScopeId)}`}
          </p>
        </div>

        <JdHandoverPendingCard />

        {canWrite && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>{editingId ? "Edit JD" : "Create JD"}</CardTitle>
                  <CardDescription>
                    Linked to employee after induction handover
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={aiBusy || busy}
                  onClick={() => void handleAiDraft()}
                >
                  {aiBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {aiBusy ? "Drafting…" : "Draft with AI"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(e) => void handleSave(e)}>
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={employeeId || undefined}
                    onValueChange={setEmployeeId}
                    disabled={Boolean(editingId)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeId &&
                        !(editingId
                          ? scopedEmployees
                          : eligible.length
                            ? eligible
                            : scopedEmployees
                        ).some((e) => e.id === employeeId) && (
                          <SelectItem value={employeeId}>
                            {(() => {
                              const emp = employees.find((e) => e.id === employeeId);
                              return emp
                                ? `${emp.firstName} ${emp.lastName} · ${emp.employeeCode}`
                                : employeeId;
                            })()}
                          </SelectItem>
                        )}
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
                      No employees ready — complete department handover first and ensure no
                      existing JD.
                    </p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="jd-no">JD no.</Label>
                    <Input
                      id="jd-no"
                      value={jdNo}
                      onChange={(e) => setJdNo(e.target.value)}
                      placeholder="JD-QA-001"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revision-no">Revision no.</Label>
                    <Input
                      id="revision-no"
                      type="number"
                      min={0}
                      step={1}
                      value={revisionNo}
                      onChange={(e) => setRevisionNo(e.target.value)}
                      required
                    />
                  </div>
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
                  <Select value={departmentId || undefined} onValueChange={setDepartmentId}>
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
                <div className="space-y-2">
                  <Label>In case of absence, hand over responsibility to</Label>
                  <Select
                    value={handoverEmployeeId || undefined}
                    onValueChange={setHandoverEmployeeId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select colleague" />
                    </SelectTrigger>
                    <SelectContent>
                      {(handoverEmployeeId &&
                      !handoverCandidates.some((e) => e.id === handoverEmployeeId) &&
                      selectedHandover
                        ? [selectedHandover, ...handoverCandidates]
                        : handoverCandidates
                      ).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {employeeFullName(e)} · {e.employeeCode}
                          {e.designation ? ` · ${e.designation}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {handoverCandidates.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No other employees available to name as absence handover.
                    </p>
                  )}
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    In case of your absence; hand over your responsibility to{" "}
                    <span className="font-semibold text-foreground">
                      {selectedHandover
                        ? employeeFullName(selectedHandover)
                        : "_______________"}
                    </span>{" "}
                    with intimation to the assignee.
                  </p>
                  {handoverEmployeeId && !selectedHandover?.userId && (
                    <p className="text-xs text-amber-700">
                      This person has no login account, so they will not receive a
                      notification.
                    </p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Job Responsibility Assigned by</Label>
                    <Select
                      value={assignedByEmployeeId || undefined}
                      onValueChange={setAssignedByEmployeeId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assigner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELF_ASSIGNER}>
                          Me ({profile?.displayName || "current user"})
                        </SelectItem>
                        {assignedByEmployeeId &&
                          assignedByEmployeeId !== SELF_ASSIGNER &&
                          !signoffCandidates.some((e) => e.id === assignedByEmployeeId) && (
                            <SelectItem value={assignedByEmployeeId}>
                              {selectedAssigned
                                ? `${employeeFullName(selectedAssigned)} · ${selectedAssigned.employeeCode}`
                                : assignedByEmployeeId}
                            </SelectItem>
                          )}
                        {signoffCandidates.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {employeeFullName(e)} · {e.employeeCode}
                            {e.designation ? ` · ${e.designation}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      They get a notification and must Approve. Then their e-signature
                      appears on the JD.
                    </p>
                    {selectedAssigned && !selectedAssigned.userId && (
                      <p className="text-xs text-amber-700">
                        This person has no login account, so they will not receive a
                        notification.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Job Responsibility Accepted by</Label>
                    <Select
                      value={acceptedByEmployeeId || undefined}
                      onValueChange={setAcceptedByEmployeeId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select acceptor" />
                      </SelectTrigger>
                      <SelectContent>
                        {acceptedByEmployeeId &&
                          !signoffCandidates.some((e) => e.id === acceptedByEmployeeId) && (
                            <SelectItem value={acceptedByEmployeeId}>
                              {selectedAccepted
                                ? `${employeeFullName(selectedAccepted)} · ${selectedAccepted.employeeCode}`
                                : acceptedByEmployeeId}
                            </SelectItem>
                          )}
                        {signoffCandidates.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {employeeFullName(e)} · {e.employeeCode}
                            {e.designation ? ` · ${e.designation}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      They get a notification and must Accept. Then their e-signature
                      appears on the JD.
                    </p>
                    {selectedAccepted && !selectedAccepted.userId && (
                      <p className="text-xs text-amber-700">
                        This person has no login account, so they will not receive a
                        notification.
                      </p>
                    )}
                  </div>
                </div>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Update JD" : "Save JD"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel edit
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Saved Job Descriptions</CardTitle>
            <CardDescription>
              View, edit, approve, delete and print JD records
            </CardDescription>
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
                <p>No Job Descriptions yet.</p>
                {canWrite && (
                  <p className="mt-1">
                    Select a handed-over employee above to create their JD.
                  </p>
                )}
              </div>
            ) : (
              visibleRecords.map((record) => {
                const emp = employees.find((e) => e.id === record.employeeId);
                const pendingForMe = myPendingSignoffs.filter((row) => row.jdId === record.id);
                const highlighted = acknowledgeFromUrl === record.id;
                const signoffLine = (label: string, signoff?: { name?: string; status?: string; acknowledgedAt?: string }) =>
                  signoff?.name ? (
                    <p className="text-xs text-muted-foreground">
                      {label}:{" "}
                      <span className="font-medium text-foreground">{signoff.name}</span>
                      {signoff.status === "acknowledged"
                        ? ` · signed ${formatDate(signoff.acknowledgedAt)}`
                        : " · pending"}
                    </p>
                  ) : null;
                return (
                  <div
                    key={record.id}
                    id={`jd-${record.id}`}
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-md border p-3 ${
                      highlighted ? "border-primary ring-2 ring-primary/30" : ""
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{record.title}</p>
                        <Badge variant={statusBadgeVariant(record.status)}>
                          {record.status}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {record.jdNo || record.id}
                        </span>
                        <span className="text-xs text-muted-foreground">Rev. {record.version}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {emp
                          ? `${emp.firstName} ${emp.lastName} · ${emp.employeeCode}`
                          : record.employeeId}{" "}
                        · {departmentLabel(departments, record.departmentId)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Effective: {formatDate(record.effectiveFrom)}
                        {record.approvedAt
                          ? ` · Approved ${formatDate(record.approvedAt)}`
                          : ""}
                      </p>
                      {record.absenceHandoverName && (
                        <p className="text-xs text-muted-foreground">
                          Absence handover:{" "}
                          <span className="font-medium text-foreground">
                            {record.absenceHandoverName}
                          </span>
                          {record.absenceHandoverStatus === "acknowledged"
                            ? ` · acknowledged ${formatDate(record.absenceHandoverAcknowledgedAt)}`
                            : " · pending acknowledgement"}
                        </p>
                      )}
                      {signoffLine("Assigned by", record.assignedBy)}
                      {signoffLine("Accepted by", record.acceptedBy)}
                      {record.absenceHandoverStatus === "acknowledged" &&
                        (record.absenceHandoverAcknowledgedByName ||
                          record.absenceHandoverSignatureText) && (
                          <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2">
                            <p
                              className="text-base leading-tight text-blue-900"
                              style={{ fontFamily: '"Segoe Script", "Lucida Handwriting", cursive' }}
                            >
                              {record.absenceHandoverAcknowledgedByName ||
                                record.absenceHandoverName}
                            </p>
                            <p className="text-[11px] italic text-muted-foreground">
                              Electronically computer-generated signature
                            </p>
                            {record.absenceHandoverSignatureText && (
                              <p className="text-[11px] text-muted-foreground">
                                {record.absenceHandoverSignatureText}
                              </p>
                            )}
                          </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrint(record)}
                      >
                        <Printer className="mr-1 h-3.5 w-3.5" />
                        Print
                      </Button>
                      {pendingForMe.map((row) => (
                        <Button
                          key={row.slot}
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleAcknowledgeHandover(record, row.slot)}
                        >
                          <FileSignature className="mr-1 h-3.5 w-3.5" />
                          {row.actionLabel}
                        </Button>
                      ))}
                      {canApprove && record.status === "draft" && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleApprove(record)}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Approve JD
                        </Button>
                      )}
                      <Can permission="jd:write">
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
                      <AdminDeleteButton
                        label="Delete"
                        size="sm"
                        variant="destructive"
                        confirmTitle="Delete this Job Description?"
                        confirmDescription="Only Super Admin can delete JD records. Linked employee jdId will be cleared."
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

export default function JdPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading job descriptions…</div>}>
      <JdPageInner />
    </Suspense>
  );
}
