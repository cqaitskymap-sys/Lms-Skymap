import { auth } from "@/lib/firebase/client";
import { isDemoMode } from "@/lib/demo/data";
import type { LegacyEmployeeInput } from "@/lib/auth/onboarding-schemas";
import { loginEmailFromEmployeeCode } from "@/lib/auth/onboarding-schemas";
import { uploadLegacyRecordFile } from "@/lib/onboarding/legacy-files";
import { splitEmployeeName, type LegacyDraft } from "@/lib/onboarding/legacy-sheet";
import { generateId, nowISO, stripUndefined } from "@/lib/services/helpers";
import { getProgressForStage, getStageDefinition, STAGE_ORDER } from "@/lib/lifecycle/stages";
import { readLifecycleStore, writeLifecycleStore } from "@/lib/lifecycle/demo-store";
import { readTrainingStore, writeTrainingStore } from "@/lib/training/demo-store";
import type { Employee, JobDescription, LifecycleEvent, TrainingNeedIdentification, UserRole } from "@/types";

export interface LegacyImportResult {
  employeeId: string;
  employeeCode: string;
  username: string;
  temporaryPassword: string;
  loginUrl: string;
  jdId: string;
  tniId: string;
}

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in");
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function importLocally(
  input: LegacyEmployeeInput,
  actor: { uid: string; name: string; role: UserRole }
): LegacyImportResult {
  const now = nowISO();
  const employeeCode = input.employeeCode;
  const existing = readLifecycleStore().employees;
  if (existing.some((e) => e.employeeCode.toUpperCase() === employeeCode)) {
    throw new Error("An employee with this employee code already exists");
  }
  const jdNo = (input.jdNo || `JD-${employeeCode}`).trim().toUpperCase();
  const training = readTrainingStore();
  if (training.jobDescriptions.some((j) => (j.jdNo || "").toUpperCase() === jdNo)) {
    throw new Error(`JD number "${jdNo}" already exists`);
  }

  const employeeId = generateId("emp");
  const jdId = generateId("jd");
  const tniId = generateId("tni");
  const stage = getStageDefinition("tni_created");
  const paper = (kind: "jd" | "tni") =>
    kind === "jd"
      ? { ...input.jdDocument, uploadedAt: now, uploadedBy: actor.uid }
      : { ...input.tniDocument, uploadedAt: now, uploadedBy: actor.uid };

  const employee = stripUndefined({
    id: employeeId,
    employeeCode,
    username: employeeCode,
    email: loginEmailFromEmployeeCode(employeeCode),
    ...(input.email ? { contactEmail: input.email } : {}),
    firstName: input.firstName,
    lastName: input.lastName,
    ...(input.mobile ? { phone: input.mobile, mobile: input.mobile } : {}),
    dateOfJoining: input.dateOfJoining,
    designation: input.designation,
    departmentId: input.departmentId,
    employmentType: "permanent",
    status: stage.employeeStatus,
    lifecycleStage: "tni_created",
    lifecycleProgress: getProgressForStage("tni_created"),
    inductionStatus: "passed",
    inductionCompletedAt: now,
    verifiedAt: now,
    verifiedBy: actor.uid,
    handedOverAt: now,
    handedOverBy: actor.uid,
    jdId,
    tniId,
    recordSource: "pre_system",
    legacyJdDocument: paper("jd"),
    legacyTniDocument: paper("tni"),
    onboardingStatus: "pending_first_login",
    accountProvisionedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  }) as Employee;

  const jd = stripUndefined({
    id: jdId,
    jdNo,
    employeeId,
    departmentId: input.departmentId,
    title: input.designation,
    version: 1,
    responsibilities: [
      "Historical Job Description uploaded from records created before this LMS.",
    ],
    qualifications: [],
    skills: [],
    status: "approved",
    approvedBy: actor.uid,
    approvedAt: now,
    effectiveFrom: input.dateOfJoining,
    sourceDocument: paper("jd"),
    importedFrom: "pre_system",
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  }) as JobDescription;

  const tni = stripUndefined({
    id: tniId,
    employeeId,
    departmentId: input.departmentId,
    jdId,
    version: 1,
    needs: [
      {
        id: generateId("need"),
        topic: "Pre-system Training Need Identification",
        priority: "medium",
        rationale: "TNI document uploaded from records created before this LMS.",
        status: "completed",
      },
    ],
    status: "approved",
    approvedBy: actor.uid,
    approvedAt: now,
    sourceDocument: paper("tni"),
    importedFrom: "pre_system",
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  }) as TrainingNeedIdentification;

  const events: LifecycleEvent[] = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf("tni_created") + 1).map(
    (lifecycleStage) => {
      const def = getStageDefinition(lifecycleStage);
      const current = lifecycleStage === "tni_created";
      return {
        id: generateId("lev"),
        employeeId,
        stage: lifecycleStage,
        title: def.label,
        description: current
          ? "Pre-system employee imported with existing JD and TNI files"
          : "Recorded from onboarding completed before this LMS",
        status: current ? "current" : "completed",
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        ...(current ? {} : { completedAt: now }),
        createdAt: now,
      };
    }
  );

  const life = readLifecycleStore();
  life.employees.unshift(employee);
  life.events = [...events, ...life.events];
  writeLifecycleStore(life);

  const store = readTrainingStore();
  store.jobDescriptions = [jd, ...store.jobDescriptions];
  store.tnis = [tni, ...store.tnis];
  writeTrainingStore(store);

  return {
    employeeId,
    employeeCode,
    username: employeeCode,
    temporaryPassword: `Temp@${Math.random().toString(36).slice(2, 8)}A1!`,
    loginUrl: `${window.location.origin}/login`,
    jdId,
    tniId,
  };
}

export async function importLegacyEmployee(
  row: LegacyDraft,
  actor: { uid: string; name: string; role: UserRole }
): Promise<LegacyImportResult> {
  if (!row.jdFile || !row.tniFile) {
    throw new Error("JD and TNI files are required");
  }
  const { firstName, lastName } = splitEmployeeName(row.name);
  const [jdDocument, tniDocument] = await Promise.all([
    uploadLegacyRecordFile({
      employeeCode: row.employeeCode,
      kind: "jd",
      file: row.jdFile,
      actorId: actor.uid,
    }),
    uploadLegacyRecordFile({
      employeeCode: row.employeeCode,
      kind: "tni",
      file: row.tniFile,
      actorId: actor.uid,
    }),
  ]);

  const input: LegacyEmployeeInput = {
    employeeCode: row.employeeCode.trim().toUpperCase(),
    firstName,
    lastName,
    email: row.email.trim().toLowerCase(),
    mobile: row.mobile.trim(),
    departmentId: row.departmentId,
    designation: row.designation.trim(),
    dateOfJoining: row.dateOfJoining,
    jdNo: row.jdNo.trim().toUpperCase(),
    jdDocument,
    tniDocument,
  };

  if (isDemoMode()) return importLocally(input, actor);

  if (!auth.currentUser) throw new Error("You must be signed in to import employees");
  const res = await fetch("/api/employees/legacy", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    details?: Record<string, string[] | undefined>;
    data?: LegacyImportResult;
  };
  if (!res.ok || !json.success || !json.data) {
    const details = json.details;
    if (details && typeof details === "object") {
      const first = Object.entries(details).find(([, msgs]) => msgs?.length);
      if (first) throw new Error(`${first[0]}: ${first[1]![0]}`);
    }
    throw new Error(json.error || `Import failed (${res.status})`);
  }
  window.dispatchEvent(new Event("pharma-lifecycle-updated"));
  window.dispatchEvent(new Event("pharma-training-updated"));
  return json.data;
}
