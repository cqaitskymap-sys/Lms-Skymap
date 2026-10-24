"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { fetchEmployeeCards, getEmployee, type EmployeeCard } from "@/lib/services/employees";
import { listUsersByRoles } from "@/lib/services/users";
import { listDepartments, departmentLabel } from "@/lib/services/departments";
import { useAuth } from "@/contexts/auth-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { escapeHtml, printHtml } from "@/lib/print";
import { calendarDateToIso, localDateInputValue } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/rbac/permissions";
import { resolveJdCatalog, snapshotFromMaster, type JdMasterRecord } from "@/lib/jd/catalog-master";
import {
  allResponsibilityLines,
  designationsFromSnapshot,
  findDesignationInSnapshot,
  matchSavedResponsibilities,
  sectionsFromSnapshot,
  selectedResponsibilityTexts,
  type JdCatalogSnapshot,
} from "@/lib/jd/responsibility-catalog";
import {
  JD_CATALOG_UPDATED_EVENT,
  listJdMasters,
  saveJdMaster,
} from "@/lib/services/jd-catalog";
import type { Department, Employee, JobDescription, JdSignoff, UserProfile, UserRole } from "@/types";

const SUB_DEPARTMENT_STORAGE_PREFIX = "jd-sub-departments:";

function readSavedSubDepartments(departmentId: string): string[] {
  if (!departmentId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${SUB_DEPARTMENT_STORAGE_PREFIX}${departmentId}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is string => typeof row === "string" && row.trim().length > 0);
  } catch {
    return [];
  }
}

function rememberSubDepartment(departmentId: string, name: string) {
  const current = readSavedSubDepartments(departmentId);
  const next = [name, ...current.filter((row) => row.toLowerCase() !== name.toLowerCase())];
  window.localStorage.setItem(
    `${SUB_DEPARTMENT_STORAGE_PREFIX}${departmentId}`,
    JSON.stringify(next)
  );
}

const SELF_ASSIGNER = "__self__";
const STAFF_KEY_PREFIX = "user:";
const STAFF_DIRECTORY_ROLES: UserProfile["role"][] = [
  "super_admin",
  "hr",
  "qa",
  "department_head",
  "trainer",
];

/** Print numbers such as revision 0 and experience 5 as 00 and 05. */
function formatTwoDigitValue(value: string | number): string {
  const raw = String(value).trim();
  const match = raw.match(/^(\d+)([\s\S]*)$/);
  if (!match) return raw;
  return `${match[1].padStart(2, "0")}${match[2]}`;
}

function staffSelectKey(uid: string): string {
  return `${STAFF_KEY_PREFIX}${uid}`;
}

function staffUidFromSelect(value: string): string | null {
  return value.startsWith(STAFF_KEY_PREFIX) ? value.slice(STAFF_KEY_PREFIX.length) : null;
}

function staffOptionLabel(user: Pick<UserProfile, "displayName" | "username" | "role">): string {
  const name = (user.displayName || "").trim() || "Staff";
  const staffId = (user.username || "").trim();
  const role = ROLE_LABELS[user.role] || user.role;
  return [name, staffId, role].filter(Boolean).join(" · ");
}

function selectionIdentity(
  value: string,
  opts: { selfUid?: string; employees: Employee[] }
): string {
  if (!value) return "";
  if (value === SELF_ASSIGNER) return opts.selfUid ? `uid:${opts.selfUid}` : "self";
  const staffUid = staffUidFromSelect(value);
  if (staffUid) return `uid:${staffUid}`;
  const emp = opts.employees.find((row) => row.id === value);
  if (emp?.userId) return `uid:${emp.userId}`;
  return `emp:${value}`;
}

function signoffFromStaffUser(user: UserProfile, employees: Employee[]): JdSignoff {
  const linked = employees.find(
    (row) => row.userId === user.uid || (user.employeeId ? row.id === user.employeeId : false)
  );
  return {
    userId: user.uid,
    name: (user.displayName || "").trim() || "Staff",
    designation: ROLE_LABELS[user.role] || user.role,
    ...(linked
      ? { employeeId: linked.id }
      : user.employeeId
        ? { employeeId: user.employeeId }
        : {}),
    status: "pending",
  };
}

function signoffValueIsListed(
  value: string,
  employees: Employee[],
  staff: UserProfile[]
): boolean {
  if (!value || value === SELF_ASSIGNER) return true;
  if (employees.some((row) => row.id === value)) return true;
  const uid = staffUidFromSelect(value);
  return Boolean(uid && staff.some((row) => row.uid === uid));
}

function unlistedSignoffLabel(
  value: string,
  opts: { employees: Employee[]; staffUsers: UserProfile[]; employee?: Employee | null }
): string {
  if (opts.employee) {
    return `${employeeFullName(opts.employee)} · ${opts.employee.employeeCode}`;
  }
  const uid = staffUidFromSelect(value);
  if (uid) {
    const user = opts.staffUsers.find((row) => row.uid === uid);
    if (user) return staffOptionLabel(user);
    return "Staff account";
  }
  const emp = opts.employees.find((row) => row.id === value);
  if (emp) return `${employeeFullName(emp)} · ${emp.employeeCode}`;
  return value;
}

function signoffToSelectValue(
  signoff: JdSignoff | undefined,
  opts: {
    selfUid?: string;
    preferSelf: boolean;
    visibleEmployees: Employee[];
    staffUsers: UserProfile[];
  }
): string {
  if (!signoff) return "";
  if (
    opts.preferSelf &&
    signoff.userId &&
    opts.selfUid &&
    signoff.userId === opts.selfUid
  ) {
    return SELF_ASSIGNER;
  }
  if (
    signoff.employeeId &&
    opts.visibleEmployees.some((row) => row.id === signoff.employeeId)
  ) {
    return signoff.employeeId;
  }
  if (signoff.userId && opts.staffUsers.some((row) => row.uid === signoff.userId)) {
    return staffSelectKey(signoff.userId);
  }
  if (signoff.employeeId) return signoff.employeeId;
  if (signoff.userId) return staffSelectKey(signoff.userId);
  return "";
}

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

function cardFullName(card?: EmployeeCard | null): string {
  if (!card) return "";
  return `${card.firstName} ${card.lastName}`.trim();
}

/** Ignore raw Firestore ids so the printed JD never shows emp_… as a person's name. */
function readablePersonName(...values: Array<string | undefined>): string {
  for (const value of values) {
    const name = (value || "").replace(/\s+/g, " ").trim();
    if (name && !/^emp_[a-z0-9_-]+$/i.test(name)) return name;
  }
  return "";
}

function mergeJdRecords(...lists: JobDescription[][]): JobDescription[] {
  const byId = new Map<string, JobDescription>();
  for (const list of lists) {
    for (const row of list) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(?:00|12):00:00(?:\.\d+)?Z)?$/.exec(value.trim());
  const d = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
    : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", match ? { timeZone: "UTC" } : undefined);
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
  const [employeeCards, setEmployeeCards] = useState<Record<string, EmployeeCard>>({});
  const [staffUsers, setStaffUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [handoverEmployeeId, setHandoverEmployeeId] = useState("");
  const [assignedByEmployeeId, setAssignedByEmployeeId] = useState("");
  const [acceptedByEmployeeId, setAcceptedByEmployeeId] = useState("");
  const [jdNo, setJdNo] = useState("");
  const [revisionNo, setRevisionNo] = useState("1");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [subDepartment, setSubDepartment] = useState("");
  const [subDepartmentDraft, setSubDepartmentDraft] = useState("");
  const [savedSubDepartments, setSavedSubDepartments] = useState<string[]>([]);
  const [designationId, setDesignationId] = useState("");
  const [selectedResponsibilityIds, setSelectedResponsibilityIds] = useState<string[]>([]);
  const [responsibilities, setResponsibilities] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [experience, setExperience] = useState("");
  const [supersedesNo, setSupersedesNo] = useState("");
  const [records, setRecords] = useState<JobDescription[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEffectiveFrom(localDateInputValue());
  }, []);
  const [aiBusy, setAiBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [myPendingSignoffs, setMyPendingSignoffs] = useState<JdPendingSignoffRow[]>([]);
  const [jdMasters, setJdMasters] = useState<JdMasterRecord[]>([]);
  const [jdMastersReady, setJdMastersReady] = useState(false);

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
          setStaffUsers([]);
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
        setStaffUsers([]);
        setRecords(jdRows);
        return;
      }

      if (profile?.role === "trainer" || profile?.role === "qa") {
        const ids = [
          ...new Set(assigned.map((row) => row.employeeId).filter((id) => Boolean(id))),
        ];
        const [depts, people] = await Promise.all([
          listDepartments().catch(() => [] as Department[]),
          Promise.all(ids.map((id) => getEmployee(id).catch(() => null))),
        ]);
        setDepartments(depts.filter((d) => d.isActive));
        setEmployees(people.filter((row): row is Employee => Boolean(row)));
        setStaffUsers([]);
        setRecords(assigned);
        return;
      }

      if (profile?.role === "department_head" && !profile.departmentId) {
        const depts = await listDepartments().catch(() => [] as Department[]);
        setDepartments(depts.filter((d) => d.isActive));
        setEmployees([]);
        setStaffUsers([]);
        setRecords(assigned);
        return;
      }

      const [emps, depts, jdRows, staff] = await Promise.all([
        listEmployeesForLifecycle(),
        listDepartments(),
        listJobDescriptions(),
        listUsersByRoles(STAFF_DIRECTORY_ROLES).catch(() => [] as UserProfile[]),
      ]);
      setEmployees(emps);
      setStaffUsers(staff);
      setDepartments(depts.filter((d) => d.isActive));
      setRecords(mergeJdRecords(jdRows, assigned));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load JD data");
      setEmployees([]);
      setStaffUsers([]);
      setDepartments([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.employeeId, profile?.departmentId, profile?.uid]);

  useEffect(() => {
    const known = new Set(employees.map((row) => row.id));
    const missing = [
      ...new Set(
        records
          .map((row) => row.employeeId)
          .filter((id) => id && !known.has(id) && !employeeCards[id])
      ),
    ];
    if (!missing.length) return;
    let cancelled = false;
    void fetchEmployeeCards(missing).then((cards) => {
      if (cancelled || !cards.length) return;
      setEmployeeCards((prev) => {
        const next = { ...prev };
        for (const card of cards) next[card.id] = card;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [employees, records, employeeCards]);

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

  const prefilledEmployeeRef = useRef<string | null>(null);
  useEffect(() => {
    if (editingId) {
      prefilledEmployeeRef.current = employeeId;
      return;
    }
    if (!employeeId) {
      prefilledEmployeeRef.current = "";
      return;
    }
    if (prefilledEmployeeRef.current === employeeId) return;
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    prefilledEmployeeRef.current = employeeId;
    if (emp.departmentId) setDepartmentId(emp.departmentId);
    if (emp.designation) {
      setJobTitle((current) => current || emp.designation);
    }
  }, [employeeId, employees, editingId]);

  const catalogEmployeeRef = useRef<string | null>(null);
  useEffect(() => {
    if (editingId) {
      catalogEmployeeRef.current = employeeId;
      return;
    }
    if (catalogEmployeeRef.current === employeeId) return;
    catalogEmployeeRef.current = employeeId;
    setSubDepartment("");
    setSubDepartmentDraft("");
    setDesignationId("");
    setSelectedResponsibilityIds([]);
  }, [employeeId, editingId]);

  useEffect(() => {
    setSavedSubDepartments(readSavedSubDepartments(departmentId));
  }, [departmentId]);

  useEffect(() => {
    let cancelled = false;
    const loadMasters = () => {
      listJdMasters()
        .then((rows) => {
          if (cancelled) return;
          setJdMasters(rows);
          setJdMastersReady(true);
        })
        .catch(() => {
          /* Keep the last good lists. Saving stays blocked until a load succeeds. */
        });
    };
    loadMasters();
    window.addEventListener(JD_CATALOG_UPDATED_EVENT, loadMasters);
    return () => {
      cancelled = true;
      window.removeEventListener(JD_CATALOG_UPDATED_EVENT, loadMasters);
    };
  }, []);

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
          !employeesWithJd.has(e.id)
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

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === departmentId) || null,
    [departments, departmentId]
  );

  const catalogSnapshot = useMemo((): JdCatalogSnapshot => {
    if (!selectedDepartment) return { sections: [], designations: [] };
    const saved = snapshotFromMaster(
      jdMasters.find((row) => row.departmentId === selectedDepartment.id)
    );
    return resolveJdCatalog(selectedDepartment, saved);
  }, [selectedDepartment, jdMasters]);

  const catalogSections = useMemo(
    () => sectionsFromSnapshot(catalogSnapshot),
    [catalogSnapshot]
  );

  const catalogDesignations = useMemo(
    () => designationsFromSnapshot(catalogSnapshot, subDepartment),
    [catalogSnapshot, subDepartment]
  );

  const selectedDesignation = useMemo(
    () => catalogDesignations.find((row) => row.id === designationId) || null,
    [catalogDesignations, designationId]
  );

  const catalogResponsibilityCount = selectedDesignation
    ? allResponsibilityLines(selectedDesignation).length
    : 0;

  const subDepartmentOptions = useMemo(() => {
    const rows = [...catalogSections];
    for (const name of savedSubDepartments) {
      if (!rows.some((row) => row.toLowerCase() === name.toLowerCase())) rows.push(name);
    }
    if (
      subDepartment &&
      !rows.some((row) => row.toLowerCase() === subDepartment.toLowerCase())
    ) {
      rows.unshift(subDepartment);
    }
    return rows;
  }, [catalogSections, savedSubDepartments, subDepartment]);

  const signoffCandidates = useMemo(
    () =>
      scopedEmployees.filter((e) => e.status !== "inactive" && e.status !== "terminated"),
    [scopedEmployees]
  );

  const staffSignoffUsers = useMemo(() => {
    const linked = new Set<string>();
    for (const row of signoffCandidates) {
      if (row.userId) linked.add(row.userId);
    }
    return staffUsers.filter((user) => {
      if (!user.uid || user.isActive === false) return false;
      if (linked.has(user.uid)) return false;
      if (user.employeeId && signoffCandidates.some((row) => row.id === user.employeeId)) {
        return false;
      }
      return true;
    });
  }, [staffUsers, signoffCandidates]);

  const assignerStaffUsers = useMemo(
    () => staffSignoffUsers.filter((user) => user.uid !== profile?.uid),
    [staffSignoffUsers, profile?.uid]
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
    setSubDepartment("");
    setSubDepartmentDraft("");
    setDesignationId("");
    setSelectedResponsibilityIds([]);
    setResponsibilities("");
    setQualifications("");
    setExperience("");
    setSupersedesNo("");
    setEffectiveFrom(localDateInputValue());
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
        (draft.responsibilities || []).map((r, i) => `${i + 1}. ${r}`).join("\n")
      );
      setQualifications((draft.qualifications || []).join("\n"));
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
    if (!jdNo.trim()) {
      toast.error("JD no. required");
      return;
    }
    const revision = Number(revisionNo);
    if (!Number.isInteger(revision) || revision < 0) {
      toast.error("Revision no. must be a whole number");
      return;
    }
    const manualResp = responsibilities
      .split("\n")
      .map((l) => l.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);
    const deptForCatalog =
      departmentId ||
      employees.find((x) => x.id === employeeId)?.departmentId ||
      "";
    const catalogDept = departments.find((d) => d.id === deptForCatalog);
    const saveSnapshot = catalogDept
      ? resolveJdCatalog(
          catalogDept,
          snapshotFromMaster(jdMasters.find((row) => row.departmentId === catalogDept.id))
        )
      : { sections: [], designations: [] };
    const catalogRows = designationsFromSnapshot(saveSnapshot, subDepartment);
    const chosenDesignation = catalogRows.find((row) => row.id === designationId) || null;
    const resolvedTitle = jobTitle.trim() || chosenDesignation?.designation || "";
    if (!resolvedTitle) {
      toast.error("Job title required");
      return;
    }
    let parsedResp = manualResp;
    const sectionCatalog = sectionsFromSnapshot(saveSnapshot).length > 0;
    if (catalogRows.length) {
      if (sectionCatalog && !subDepartment.trim()) {
        toast.error("Add a sub department");
        return;
      }
      if (!chosenDesignation) {
        toast.error("Select a designation");
        return;
      }
      parsedResp = [
        ...selectedResponsibilityTexts(chosenDesignation, selectedResponsibilityIds),
        ...manualResp,
      ];
    }
    if (!parsedResp.length) {
      toast.error(
        catalogRows.length ? "Select at least one responsibility" : "Add at least one responsibility"
      );
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
    const assignedIdentity = selectionIdentity(assignedByEmployeeId, {
      selfUid: profile.uid,
      employees,
    });
    const acceptedIdentity = selectionIdentity(acceptedByEmployeeId, {
      selfUid: profile.uid,
      employees,
    });
    if (assignedIdentity && acceptedIdentity && assignedIdentity === acceptedIdentity) {
      toast.error("Assigned by and Accepted by must be different people");
      return;
    }
    const handoverName = employeeFullName(handoverEmp);
    if (!handoverName) {
      toast.error("Selected handover person has no name");
      return;
    }

    const assignedIsSelf = assignedByEmployeeId === SELF_ASSIGNER;
    const assignedStaffUid = staffUidFromSelect(assignedByEmployeeId);
    const assignedStaff = assignedStaffUid
      ? staffUsers.find((user) => user.uid === assignedStaffUid)
      : undefined;
    const assignedEmp =
      assignedIsSelf || assignedStaffUid
        ? null
        : employees.find((x) => x.id === assignedByEmployeeId);
    if (!assignedIsSelf && !assignedStaff && !assignedEmp) {
      toast.error("Select who assigns the job responsibility");
      return;
    }
    const acceptedStaffUid = staffUidFromSelect(acceptedByEmployeeId);
    const acceptedStaff = acceptedStaffUid
      ? staffUsers.find((user) => user.uid === acceptedStaffUid)
      : undefined;
    const acceptedEmp = acceptedStaffUid
      ? null
      : employees.find((x) => x.id === acceptedByEmployeeId);
    if (!acceptedStaff && !acceptedEmp) {
      toast.error("Select who accepts the job responsibility");
      return;
    }

    setBusy(true);
    try {
      const handoverUid =
        handoverEmp.userId || (await resolveLinkedUserUid(handoverEmp.id));
      const assignedUid = assignedIsSelf
        ? profile.uid
        : assignedStaff
          ? assignedStaff.uid
          : assignedEmp?.userId ||
            (assignedEmp ? await resolveLinkedUserUid(assignedEmp.id) : undefined);
      const acceptedUid = acceptedStaff
        ? acceptedStaff.uid
        : acceptedEmp!.userId || (await resolveLinkedUserUid(acceptedEmp!.id));

      const assignedName = assignedIsSelf
        ? (profile.displayName || "").trim() || "Current user"
        : assignedStaff
          ? (assignedStaff.displayName || "").trim() || "Staff"
          : employeeFullName(assignedEmp);
      const assignedBy: JdSignoff = assignedIsSelf
        ? {
            userId: profile.uid,
            name: assignedName,
            ...(profile.employeeId ? { employeeId: profile.employeeId } : {}),
            designation: ROLE_LABELS[profile.role] || profile.role,
            status: "pending",
          }
        : assignedStaff
          ? signoffFromStaffUser(assignedStaff, employees)
          : {
              employeeId: assignedEmp!.id,
              name: assignedName,
              designation: assignedEmp!.designation,
              ...(assignedUid ? { userId: assignedUid } : {}),
              status: "pending",
            };
      const acceptedBy: JdSignoff = acceptedStaff
        ? signoffFromStaffUser(acceptedStaff, employees)
        : {
            employeeId: acceptedEmp!.id,
            name: employeeFullName(acceptedEmp),
            designation: acceptedEmp!.designation,
            ...(acceptedUid ? { userId: acceptedUid } : {}),
            status: "pending",
          };

      const subject = employees.find((row) => row.id === employeeId);
      const subjectCard = employeeCards[employeeId];
      const savedName = readablePersonName(
        subject ? employeeFullName(subject) : "",
        cardFullName(subjectCard)
      );
      const savedCode = subject?.employeeCode || subjectCard?.employeeCode || "";
      const savedJoining = subject?.dateOfJoining || subjectCard?.dateOfJoining || "";
      const savedReporting = readablePersonName(
        subject?.reportingManagerName,
        subjectCard?.reportingManagerName
      );
      const payload = {
        employeeId,
        ...(savedName ? { employeeName: savedName } : {}),
        ...(savedCode ? { employeeCode: savedCode } : {}),
        ...(savedJoining ? { employeeDateOfJoining: savedJoining } : {}),
        ...(savedReporting ? { reportingTo: savedReporting } : {}),
        departmentId: dept,
        jdNo: jdNo.trim(),
        title: resolvedTitle,
        version: revision,
        subDepartment: subDepartment.trim(),
        responsibilities: parsedResp,
        qualifications: qualifications
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        skills: [] as string[],
        experience: experience.trim(),
        supersedesNo: supersedesNo.trim(),
        effectiveFrom: calendarDateToIso(effectiveFrom),
        absenceHandoverEmployeeId: handoverEmp.id,
        absenceHandoverName: handoverName,
        ...(handoverUid ? { absenceHandoverUserId: handoverUid } : {}),
        assignedBy,
        acceptedBy,
      };

      const previous = editingId ? records.find((r) => r.id === editingId) : undefined;
      const acceptedName = acceptedBy.name || "";
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
    setSubDepartment(record.subDepartment || "");
    setSubDepartmentDraft("");
    const dept = departments.find((d) => d.id === record.departmentId);
    const matched = dept
      ? findDesignationInSnapshot(
          resolveJdCatalog(
            dept,
            snapshotFromMaster(jdMasters.find((row) => row.departmentId === dept.id))
          ),
          record.title,
          record.subDepartment
        )
      : undefined;
    if (matched) {
      const restored = matchSavedResponsibilities(matched, record.responsibilities || []);
      setDesignationId(matched.id);
      setSelectedResponsibilityIds(restored.ids);
      setResponsibilities(restored.extra.join("\n"));
    } else {
      setDesignationId("");
      setSelectedResponsibilityIds([]);
      setResponsibilities((record.responsibilities || []).map((r, i) => `${i + 1}. ${r}`).join("\n"));
    }
    setQualifications((record.qualifications || []).join("\n"));
    setExperience(record.experience || "");
    setSupersedesNo(record.supersedesNo || "");
    setEffectiveFrom((record.effectiveFrom || "").slice(0, 10));
    setHandoverEmployeeId(record.absenceHandoverEmployeeId || "");
    setAssignedByEmployeeId(
      signoffToSelectValue(record.assignedBy, {
        selfUid: profile?.uid,
        preferSelf: true,
        visibleEmployees: signoffCandidates,
        staffUsers,
      })
    );
    setAcceptedByEmployeeId(
      signoffToSelectValue(record.acceptedBy, {
        selfUid: profile?.uid,
        preferSelf: false,
        visibleEmployees: signoffCandidates,
        staffUsers,
      }) || record.employeeId
    );
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

  async function handlePrint(record: JobDescription) {
    const emp = employees.find((e) => e.id === record.employeeId) || null;
    let card = employeeCards[record.employeeId];
    const personName = () =>
      readablePersonName(
        emp ? employeeFullName(emp) : "",
        cardFullName(card),
        record.employeeName
      );
    if (!personName()) {
      const [fetched] = await fetchEmployeeCards([record.employeeId]).catch(() => []);
      if (fetched) {
        card = fetched;
        setEmployeeCards((prev) => ({ ...prev, [fetched.id]: fetched }));
      }
    }
    const fullName = personName() || "—";
    if (fullName === "—") {
      toast.error("Employee name could not be loaded for this Job Description");
    }
    const deptName =
      departmentLabel(departments, record.departmentId) ||
      emp?.departmentName ||
      card?.departmentName ||
      "—";
    const employeeCode =
      emp?.employeeCode || card?.employeeCode || record.employeeCode || "—";
    const joiningDate = formatDate(
      emp?.dateOfJoining || card?.dateOfJoining || record.employeeDateOfJoining
    );
    const effectiveDate = formatDate(record.effectiveFrom);
    const qualification =
      (record.qualifications || []).filter(Boolean).join(", ") || "—";
    const experienceRaw = record.experience?.trim() || "";
    const experienceText = experienceRaw ? formatTwoDigitValue(experienceRaw) : "—";
    const managerFromList = employees.find(
      (row) => row.id === (emp?.reportingManagerId || card?.reportingManagerId)
    );
    const reportingTo =
      readablePersonName(
        record.reportingTo,
        emp?.reportingManagerName,
        card?.reportingManagerName,
        managerFromList ? employeeFullName(managerFromList) : ""
      ) || "—";
    const revisionNo = formatTwoDigitValue(record.version ?? 0);
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

    const responsibilityRows = ((record.responsibilities || []).length
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
            .info-table { table-layout: fixed; }
            .info-table .label { font-weight: 700; width: 24%; white-space: normal; }
            .info-table .value { width: 26%; word-break: break-word; }
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

  function handleDepartmentChange(nextId: string) {
    setDepartmentId(nextId);
    if (nextId === departmentId) return;
    setSubDepartment("");
    setSubDepartmentDraft("");
    setDesignationId("");
    setSelectedResponsibilityIds([]);
  }

  async function addSubDepartment() {
    const name = subDepartmentDraft.trim();
    if (!departmentId) {
      toast.error("Select a department first");
      return;
    }
    if (!name) {
      toast.error("Enter a sub department");
      return;
    }
    const catalogMatch = catalogSnapshot.sections.find(
      (row) => row.name.toLowerCase() === name.toLowerCase()
    );
    if (catalogMatch) {
      setSubDepartment(catalogMatch.name);
      setSubDepartmentDraft("");
      setDesignationId("");
      setSelectedResponsibilityIds([]);
      return;
    }
    if (profile?.role === "super_admin" && selectedDepartment) {
      if (!jdMastersReady) {
        toast.error("Department lists are still loading. Wait a moment, then add again.");
        return;
      }
      try {
        await saveJdMaster({
          departmentId: selectedDepartment.id,
          sections: [...catalogSnapshot.sections, { name, designations: [] }],
          designations: catalogSnapshot.designations,
          updatedBy: profile.uid,
        });
        toast.success("Sub department saved. Add its designation from Manage lists.");
      } catch (err) {
        rememberSubDepartment(departmentId, name);
        setSavedSubDepartments(readSavedSubDepartments(departmentId));
        toast.error(err instanceof Error ? err.message : "Could not save sub department");
      }
    } else {
      rememberSubDepartment(departmentId, name);
      setSavedSubDepartments(readSavedSubDepartments(departmentId));
    }
    setSubDepartment(name);
    setSubDepartmentDraft("");
    setDesignationId("");
    setSelectedResponsibilityIds([]);
  }

  function chooseSubDepartment(name: string) {
    setSubDepartment(name);
    setDesignationId("");
    setSelectedResponsibilityIds([]);
  }

  function handleDesignationChange(nextId: string) {
    setDesignationId(nextId);
    setSelectedResponsibilityIds([]);
    const row = catalogDesignations.find((item) => item.id === nextId);
    if (row) setJobTitle(row.designation);
  }

  function toggleResponsibility(id: string, checked: boolean) {
    setSelectedResponsibilityIds((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((row) => row !== id)
    );
  }

  const canWrite = can("jd:write");
  const canApprove = can("jd:approve");

  return (
    <RequirePermission permission="jd:read">
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Job Description</h1>
            <p className="text-muted-foreground">
              Department Head creates JD after handover
              {deptScopeId && ` · ${departmentLabel(departments, deptScopeId)}`}
            </p>
          </div>
          {profile?.role === "super_admin" && (
            <Button variant="outline" asChild>
              <Link href="/dashboard/jd/masters">Manage lists</Link>
            </Button>
          )}
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
                  <Label>Department</Label>
                  <Select value={departmentId || undefined} onValueChange={handleDepartmentChange}>
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
                  <Label>Sub department</Label>
                  {subDepartmentOptions.length > 0 && (
                    <Select
                      value={subDepartment || undefined}
                      onValueChange={chooseSubDepartment}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sub department" />
                      </SelectTrigger>
                      <SelectContent>
                        {subDepartmentOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={subDepartmentDraft}
                      onChange={(e) => setSubDepartmentDraft(e.target.value)}
                      placeholder="Add sub department"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void addSubDepartment();
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" onClick={() => void addSubDepartment()}>
                      Add
                    </Button>
                  </div>
                  {subDepartment && (
                    <p className="text-xs text-muted-foreground">
                      Selected sub department: {subDepartment}
                    </p>
                  )}
                </div>
                {catalogDesignations.length > 0 && (
                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <Select
                      value={designationId || undefined}
                      onValueChange={handleDesignationChange}
                      disabled={catalogSections.length > 0 && !subDepartment}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            catalogSections.length > 0 && !subDepartment
                              ? "Select a sub department first"
                              : "Select designation"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogDesignations.map((row) => (
                          <SelectItem key={row.id} value={row.id}>
                            {row.designation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Job title</Label>
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder={selectedDesignation?.designation || "Job title"}
                  />
                </div>
                {selectedDesignation ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Label>Responsibilities</Label>
                        <p className="text-xs text-muted-foreground">
                          {selectedResponsibilityIds.length} of {catalogResponsibilityCount}{" "}
                          selected for {selectedDesignation.designation}. Selected lines are added
                          to this employee.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSelectedResponsibilityIds(
                              allResponsibilityLines(selectedDesignation).map((line) => line.id)
                            )
                          }
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedResponsibilityIds([])}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-96 space-y-4 overflow-y-auto rounded-md border p-3">
                      {selectedDesignation.groups.map((group, groupIndex) => (
                        <div key={`${selectedDesignation.id}-${groupIndex}`} className="space-y-2">
                          <p className="text-sm font-medium">
                            {group.code ? `${group.code}. ${group.title}` : group.title}
                          </p>
                          {group.lines.map((line, lineIndex) => (
                            <label
                              key={`${line.id}-${lineIndex}`}
                              className="flex cursor-pointer items-start gap-2 text-sm leading-snug"
                            >
                              <Checkbox
                                className="mt-0.5"
                                checked={selectedResponsibilityIds.includes(line.id)}
                                onCheckedChange={(checked) =>
                                  toggleResponsibility(line.id, checked === true)
                                }
                              />
                              <span>
                                {line.code ? (
                                  <span className="mr-1 font-medium">{line.code}</span>
                                ) : null}
                                {line.text}
                              </span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label>Additional responsibilities (optional, one per line)</Label>
                      <Textarea
                        rows={3}
                        value={responsibilities}
                        onChange={(e) => setResponsibilities(e.target.value)}
                        placeholder="Anything not in the list above"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Responsibilities (one per line)</Label>
                    {catalogSections.length > 0 && !catalogDesignations.length ? (
                      <p className="text-xs text-muted-foreground">
                        Select a sub department, then a designation. Responsibilities for that
                        section will appear here.
                      </p>
                    ) : catalogDesignations.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Select a designation to choose from the saved responsibilities.
                      </p>
                    ) : departmentId ? (
                      <p className="text-xs text-muted-foreground">
                        Saved responsibilities for this department are not added yet.
                      </p>
                    ) : null}
                    <Textarea
                      rows={5}
                      value={responsibilities}
                      onChange={(e) => setResponsibilities(e.target.value)}
                    />
                  </div>
                )}
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
                    <p className="text-xs text-amber-700 dark:text-amber-200">
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
                          !signoffValueIsListed(
                            assignedByEmployeeId,
                            signoffCandidates,
                            assignerStaffUsers
                          ) && (
                            <SelectItem value={assignedByEmployeeId}>
                              {unlistedSignoffLabel(assignedByEmployeeId, {
                                employees,
                                staffUsers,
                                employee: selectedAssigned,
                              })}
                            </SelectItem>
                          )}
                        {assignerStaffUsers.map((user) => (
                          <SelectItem key={user.uid} value={staffSelectKey(user.uid)}>
                            {staffOptionLabel(user)}
                          </SelectItem>
                        ))}
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
                      <p className="text-xs text-amber-700 dark:text-amber-200">
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
                          !signoffValueIsListed(
                            acceptedByEmployeeId,
                            signoffCandidates,
                            staffSignoffUsers
                          ) && (
                            <SelectItem value={acceptedByEmployeeId}>
                              {unlistedSignoffLabel(acceptedByEmployeeId, {
                                employees,
                                staffUsers,
                                employee: selectedAccepted,
                              })}
                            </SelectItem>
                          )}
                        {staffSignoffUsers.map((user) => (
                          <SelectItem key={user.uid} value={staffSelectKey(user.uid)}>
                            {staffOptionLabel(user)}
                          </SelectItem>
                        ))}
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
                      <p className="text-xs text-amber-700 dark:text-amber-200">
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
                <p>
                  {records.length === 0
                    ? "No Job Descriptions yet."
                    : "No Job Descriptions match this view."}
                </p>
                {canWrite && records.length === 0 && (
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
                    className={`flex w-full flex-wrap items-start justify-between gap-3 rounded-lg border p-3 ${
                      highlighted ? "border-primary ring-2 ring-primary/30" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold leading-tight">{record.title}</p>
                        <Badge variant={statusBadgeVariant(record.status)}>
                          {record.status}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {record.jdNo || record.id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Rev. {formatTwoDigitValue(record.version ?? 0)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const card = employeeCards[record.employeeId];
                          const name = readablePersonName(
                            emp ? employeeFullName(emp) : "",
                            cardFullName(card),
                            record.employeeName
                          );
                          const code =
                            emp?.employeeCode || card?.employeeCode || record.employeeCode || "";
                          return `${name || "Name not loaded"}${code ? ` · ${code}` : ""}`;
                        })()}{" "}
                        · {departmentLabel(departments, record.departmentId)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Effective: {formatDate(record.effectiveFrom)}
                        {record.approvedAt
                          ? ` · Approved ${formatDate(record.approvedAt)}`
                          : ""}
                      </p>
                      {record.sourceDocument?.downloadUrl && (
                        <a
                          href={record.sourceDocument.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Uploaded file: {record.sourceDocument.fileName}
                        </a>
                      )}
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
                          <div className="mt-1.5 w-fit max-w-full rounded-md border border-dashed bg-muted/40 px-2.5 py-1.5">
                            <p
                              className="text-base leading-tight text-blue-800 dark:text-blue-300"
                              style={{ fontFamily: '"Segoe Script", "Lucida Handwriting", cursive' }}
                            >
                              {record.absenceHandoverAcknowledgedByName ||
                                record.absenceHandoverName}
                            </p>
                            <p className="text-[11px] italic leading-tight text-muted-foreground">
                              Electronically computer-generated signature
                            </p>
                            {record.absenceHandoverSignatureText && (
                              <p className="text-[11px] leading-tight text-muted-foreground">
                                {record.absenceHandoverSignatureText}
                              </p>
                            )}
                          </div>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handlePrint(record)}
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
