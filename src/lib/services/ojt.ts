/**
 * On Job Training service — topics, yearly planner, employee matrix,
 * assignments, practical execution, evaluation, acknowledgements, approvals.
 * Firestore when available; local demo store otherwise.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore/lite";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage, COLLECTIONS } from "@/lib/firebase/client";
import type { Employee, SopDocument, SopVersion } from "@/types";
import type {
  OjtActor,
  OjtApplicability,
  OjtAssignment,
  OjtAttachment,
  OjtAttachmentKind,
  OjtDashboardStats,
  OjtEvaluation,
  OjtEvaluationCriterion,
  OjtPlan,
  OjtSettings,
  OjtTopic,
} from "@/types/ojt";
import { generateId, nowISO, stripUndefined } from "@/lib/services/helpers";
import {
  DEFAULT_EVALUATION_CRITERIA,
  DEFAULT_OJT_SETTINGS,
  OJT_ACK_STATEMENT,
  calendarDateToIso,
  currentCalendarMonth,
  currentCalendarYear,
  dateFallsInMonth,
  parseCalendarDateParts,
} from "@/lib/ojt/constants";
import {
  assertTransition,
  isOjtOverdue,
  statusAfterEmployeeAck,
  statusAfterHodDecision,
  statusAfterTrainerCompletion,
} from "@/lib/ojt/workflow";
import { listDepartments } from "@/lib/services/departments";
import { listUsersByRoles } from "@/lib/services/users";
import {
  notifyOjtUpdated,
  preferOjtLocal,
  readOjtStore,
  writeOjtStore,
} from "@/lib/ojt/demo-store";
import { QA_OJT_SEED_TOPICS, normalizeSopNumber } from "@/lib/ojt/seed-topics";
import { getSopBundle, listSopsDetailed } from "@/lib/services/sops";
import { createNotification, notifyEmployee } from "@/lib/services/notifications";
import { recordAuditEvent } from "@/lib/services/audit-logs";
import { isDemoMode } from "@/lib/demo/data";

function firestoreFields(snap: { data: () => unknown }): Record<string, unknown> {
  const data = snap.data();
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

function sanitize<T>(value: T): T {
  return stripUndefined(JSON.parse(JSON.stringify(value)) as T);
}

function isPermissionDenied(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  return code === "permission-denied" || /insufficient permissions/i.test(String(err));
}

function rethrowOjtPermission(err: unknown): never {
  if (isPermissionDenied(err)) {
    throw new Error(
      "OJT Firestore collections are blocked. Live rules on lms-skymap do not include ojt_topics / ojt_assignments. From this repo run: npx firebase-tools deploy --only firestore:rules,firestore:indexes --project lms-skymap"
    );
  }
  throw err;
}

async function ojtGetDocs(
  q: Parameters<typeof getDocs>[0]
): Promise<Awaited<ReturnType<typeof getDocs>>> {
  try {
    return await getDocs(q);
  } catch (err) {
    return rethrowOjtPermission(err);
  }
}

async function ojtGetDoc(
  ref: Parameters<typeof getDoc>[0]
): Promise<Awaited<ReturnType<typeof getDoc>>> {
  try {
    return await getDoc(ref);
  } catch (err) {
    return rethrowOjtPermission(err);
  }
}

async function ojtSetDoc(path: Parameters<typeof setDoc>[0], data: unknown) {
  try {
    await setDoc(path, data as Parameters<typeof setDoc>[1]);
  } catch (err) {
    return rethrowOjtPermission(err);
  }
}

async function safeNotify(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.warn("[ojt] notification failed", err);
  }
}

async function departmentHeadUserId(departmentId?: string): Promise<string | undefined> {
  if (!departmentId) return undefined;
  const depts = await listDepartments().catch(() => []);
  return depts.find((d) => d.id === departmentId)?.headUserId;
}

async function notifyOjtApproverQueue(assignment: OjtAssignment, actor: OjtActor) {
  await safeNotify(async () => {
    if (assignment.status === "verification_pending") {
      const hodId = assignment.hodUserId || (await departmentHeadUserId(assignment.departmentId));
      if (hodId && hodId !== actor.uid) {
        await createNotification({
          userId: hodId,
          type: "ojt",
          title: "OJT HOD verification pending",
          message: `${assignment.employeeName} — ${assignment.trainingTopic}`,
          link: `/dashboard/ojt/assignments/${assignment.id}`,
          actorId: actor.uid,
        });
      }
    }
    if (assignment.status === "qa_pending") {
      const qaUsers = await listUsersByRoles(["qa"]).catch(() => []);
      await Promise.all(
        qaUsers
          .filter((u) => u.uid && u.uid !== actor.uid)
          .map((u) =>
            createNotification({
              userId: u.uid,
              type: "ojt",
              title: "OJT QA approval pending",
              message: `${assignment.employeeName} — ${assignment.trainingTopic}`,
              link: `/dashboard/ojt/assignments/${assignment.id}`,
              actorId: actor.uid,
            })
          )
      );
    }
  });
}

async function audit(params: {
  action: Parameters<typeof recordAuditEvent>[0]["action"];
  resourceType: string;
  resourceId: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  await recordAuditEvent(params);
}

export type OjtAssignmentFilters = {
  employeeId?: string;
  departmentId?: string;
  trainerId?: string;
  year?: number;
  topicId?: string;
  planId?: string;
  status?: OjtAssignment["status"];
  month?: number;
};

function applyAssignmentFilters(
  rows: OjtAssignment[],
  filters?: OjtAssignmentFilters
): OjtAssignment[] {
  if (!filters) return rows;
  return rows.filter((a) => {
    if (filters.employeeId && a.employeeId !== filters.employeeId) return false;
    if (filters.departmentId && a.departmentId !== filters.departmentId) return false;
    if (filters.trainerId && a.trainerId !== filters.trainerId) return false;
    if (filters.year && a.year !== filters.year) return false;
    if (filters.topicId && a.topicId !== filters.topicId) return false;
    if (filters.planId && a.planId !== filters.planId) return false;
    if (filters.status && a.status !== filters.status) return false;
    if (filters.month && a.plannedExecutionMonth !== filters.month && a.selectionMonth !== filters.month) {
      return false;
    }
    return true;
  });
}

async function saveTopic(topic: OjtTopic): Promise<void> {
  if (preferOjtLocal()) {
    const store = readOjtStore();
    const idx = store.topics.findIndex((t) => t.id === topic.id);
    if (idx >= 0) store.topics[idx] = topic;
    else store.topics.push(topic);
    writeOjtStore(store);
    return;
  }
  await ojtSetDoc(doc(db, COLLECTIONS.ojtTopics, topic.id), sanitize(topic));
  notifyOjtUpdated();
}

async function savePlan(plan: OjtPlan): Promise<void> {
  if (preferOjtLocal()) {
    const store = readOjtStore();
    const idx = store.plans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) store.plans[idx] = plan;
    else store.plans.push(plan);
    writeOjtStore(store);
    return;
  }
  await ojtSetDoc(doc(db, COLLECTIONS.ojtPlans, plan.id), sanitize(plan));
  notifyOjtUpdated();
}

async function saveAssignment(assignment: OjtAssignment): Promise<void> {
  if (preferOjtLocal()) {
    const store = readOjtStore();
    const idx = store.assignments.findIndex((a) => a.id === assignment.id);
    if (idx >= 0) store.assignments[idx] = assignment;
    else store.assignments.push(assignment);
    writeOjtStore(store);
    return;
  }
  await ojtSetDoc(doc(db, COLLECTIONS.ojtAssignments, assignment.id), sanitize(assignment));
  notifyOjtUpdated();
}

export async function getOjtSettings(): Promise<OjtSettings> {
  const now = nowISO();
  const fallback: OjtSettings = {
    ...DEFAULT_OJT_SETTINGS,
    createdAt: now,
    updatedAt: now,
    createdBy: "system",
  };

  if (preferOjtLocal()) {
    const stored = readOjtStore().settings;
    return stored ?? fallback;
  }

  const snap = await ojtGetDoc(doc(db, COLLECTIONS.ojtSettings, "global"));
  if (!snap.exists()) return fallback;
  return { id: snap.id, ...firestoreFields(snap) } as OjtSettings;
}

export async function updateOjtSettings(
  patch: Partial<Omit<OjtSettings, "id" | "createdAt" | "createdBy">>,
  actor: OjtActor
): Promise<OjtSettings> {
  const current = await getOjtSettings();
  const next: OjtSettings = {
    ...current,
    ...patch,
    id: "global",
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  if (preferOjtLocal()) {
    const store = readOjtStore();
    store.settings = next;
    writeOjtStore(store);
  } else {
    await ojtSetDoc(doc(db, COLLECTIONS.ojtSettings, "global"), sanitize(next));
    notifyOjtUpdated();
  }
  await audit({
    action: "update",
    resourceType: "ojt_settings",
    resourceId: "global",
    description: "Updated OJT approval / overdue settings",
    before: current as unknown as Record<string, unknown>,
    after: next as unknown as Record<string, unknown>,
  });
  return next;
}

export async function listOjtEvaluationCriteria(): Promise<OjtEvaluationCriterion[]> {
  const now = nowISO();
  const seed = (): OjtEvaluationCriterion[] =>
    DEFAULT_EVALUATION_CRITERIA.map((c) => ({
      ...c,
      createdAt: now,
      updatedAt: now,
      createdBy: "system",
    }));

  if (preferOjtLocal()) {
    const store = readOjtStore();
    if (!store.criteria.length) {
      store.criteria = seed();
      writeOjtStore(store);
    }
    return [...store.criteria].sort((a, b) => a.order - b.order);
  }

  const snap = await ojtGetDocs(collection(db, COLLECTIONS.ojtEvaluationCriteria));
  if (snap.empty) {
    const rows = seed();
    try {
      await Promise.all(
        rows.map((c) => setDoc(doc(db, COLLECTIONS.ojtEvaluationCriteria, c.id), sanitize(c)))
      );
    } catch (err) {
      if (isPermissionDenied(err)) return rows;
      return rethrowOjtPermission(err);
    }
    return rows;
  }
  return snap.docs
    .map((d) => ({ id: d.id, ...firestoreFields(d) }) as OjtEvaluationCriterion)
    .sort((a, b) => a.order - b.order);
}

export async function upsertOjtEvaluationCriterion(
  data: Omit<OjtEvaluationCriterion, "createdAt" | "updatedAt" | "createdBy"> & {
    createdAt?: string;
    createdBy?: string;
  },
  actor: OjtActor
): Promise<OjtEvaluationCriterion> {
  const now = nowISO();
  const existing = (await listOjtEvaluationCriteria()).find((c) => c.id === data.id);
  const row: OjtEvaluationCriterion = {
    ...data,
    id: data.id || generateId("ojt_crit"),
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || actor.uid,
    updatedAt: now,
    updatedBy: actor.uid,
  };
  if (preferOjtLocal()) {
    const store = readOjtStore();
    store.criteria = [...store.criteria.filter((c) => c.id !== row.id), row];
    writeOjtStore(store);
  } else {
    await ojtSetDoc(doc(db, COLLECTIONS.ojtEvaluationCriteria, row.id), sanitize(row));
    notifyOjtUpdated();
  }
  return row;
}

export async function listOjtTopics(departmentId?: string): Promise<OjtTopic[]> {
  if (preferOjtLocal()) {
    let rows = [...readOjtStore().topics];
    if (departmentId) rows = rows.filter((t) => t.departmentId === departmentId);
    return rows.sort((a, b) => a.trainingTopic.localeCompare(b.trainingTopic));
  }
  const q = departmentId
    ? query(collection(db, COLLECTIONS.ojtTopics), where("departmentId", "==", departmentId))
    : collection(db, COLLECTIONS.ojtTopics);
  const snap = await ojtGetDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...firestoreFields(d) }) as OjtTopic)
    .sort((a, b) => a.trainingTopic.localeCompare(b.trainingTopic));
}

export async function getOjtTopic(id: string): Promise<OjtTopic | null> {
  if (preferOjtLocal()) {
    return readOjtStore().topics.find((t) => t.id === id) || null;
  }
  const snap = await ojtGetDoc(doc(db, COLLECTIONS.ojtTopics, id));
  return snap.exists() ? ({ id: snap.id, ...firestoreFields(snap) } as OjtTopic) : null;
}

type CurrentSopSnapshot = {
  sopId: string;
  sopNumber: string;
  sopVersionId: string;
  sopVersionNumber: string;
  effectiveDate?: string;
  revisionNumber?: string;
};

export async function resolveCurrentSopSnapshot(sopId: string): Promise<CurrentSopSnapshot> {
  const bundle = await getSopBundle(sopId);
  const sop = bundle.sop;
  const version = bundle.currentVersion;
  if (!sop) throw new Error("SOP not found");
  if (sop.status !== "approved") {
    throw new Error("Training shall be imparted on the current approved SOP version — this SOP is not approved");
  }
  if (!version || version.status !== "approved") {
    throw new Error("No current approved SOP version is available for this document");
  }
  return {
    sopId: sop.id,
    sopNumber: sop.sopNumber,
    sopVersionId: version.id,
    sopVersionNumber: version.versionNumber,
    effectiveDate: version.effectiveDate || sop.effectiveDate,
    revisionNumber: version.versionNumber,
  };
}

function matchSopByNumber(
  sops: (SopDocument & { version?: SopVersion })[],
  sopNumber: string
): (SopDocument & { version?: SopVersion }) | undefined {
  const needle = normalizeSopNumber(sopNumber);
  return sops.find((s) => normalizeSopNumber(s.sopNumber) === needle);
}

export async function createOjtTopic(
  data: Omit<OjtTopic, "id" | "createdAt" | "updatedAt" | "createdBy" | "trainingType" | "isActive"> & {
    trainingType?: OjtTopic["trainingType"];
    isActive?: boolean;
  },
  actor: OjtActor
): Promise<OjtTopic> {
  const now = nowISO();
  let snapshot: Partial<CurrentSopSnapshot> = {};
  if (data.sopId) {
    snapshot = await resolveCurrentSopSnapshot(data.sopId);
  }
  const topic: OjtTopic = {
    ...data,
    ...snapshot,
    id: generateId("ojt_topic"),
    trainingType: data.trainingType || "on_job",
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  };
  await saveTopic(topic);
  await audit({
    action: "create",
    resourceType: "ojt_topic",
    resourceId: topic.id,
    description: `Created OJT topic ${topic.trainingTopic}`,
    after: { trainingTopic: topic.trainingTopic, sopNumber: topic.sopNumber || topic.referenceDocumentNumber },
  });
  return topic;
}

export async function updateOjtTopic(
  id: string,
  patch: Partial<Omit<OjtTopic, "id" | "createdAt" | "createdBy">>,
  actor: OjtActor
): Promise<OjtTopic> {
  const existing = await getOjtTopic(id);
  if (!existing) throw new Error("OJT topic not found");
  let snapshot: Partial<CurrentSopSnapshot> = {};
  if (patch.sopId && patch.sopId !== existing.sopId) {
    snapshot = await resolveCurrentSopSnapshot(patch.sopId);
  }
  const next: OjtTopic = {
    ...existing,
    ...patch,
    ...snapshot,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveTopic(next);
  await audit({
    action: "update",
    resourceType: "ojt_topic",
    resourceId: id,
    description: `Updated OJT topic ${next.trainingTopic}`,
    before: { trainingTopic: existing.trainingTopic, sopId: existing.sopId },
    after: { trainingTopic: next.trainingTopic, sopId: next.sopId },
  });
  return next;
}

export async function ensureQaOjtTopicCatalog(
  department: { id: string; name: string },
  actor: OjtActor
): Promise<{ created: number; linked: number }> {
  const existing = await listOjtTopics(department.id);
  const sops = await listSopsDetailed({ status: "approved" }).catch(
    () => [] as (SopDocument & { version?: SopVersion })[]
  );
  let created = 0;
  let linked = 0;
  for (const seed of QA_OJT_SEED_TOPICS) {
    const already = existing.find((t) => {
      if (seed.sopNumber && t.sopNumber) {
        return normalizeSopNumber(t.sopNumber) === normalizeSopNumber(seed.sopNumber);
      }
      return t.trainingTopic === seed.trainingTopic;
    });
    if (already) continue;
    const matched = seed.sopNumber ? matchSopByNumber(sops, seed.sopNumber) : undefined;
    await createOjtTopic(
      {
        trainingTopic: matched?.title || seed.trainingTopic,
        description: "Imported from QA On Job Training matrix",
        departmentId: department.id,
        departmentName: department.name,
        sopId: matched?.id,
        sopNumber: matched?.sopNumber || seed.sopNumber,
        referenceDocumentNumber: seed.referenceDocumentNumber || seed.sopNumber || "NA",
      },
      actor
    );
    created += 1;
    if (matched) linked += 1;
  }
  return { created, linked };
}

export async function listOjtPlans(filters?: {
  year?: number;
  departmentId?: string;
}): Promise<OjtPlan[]> {
  if (preferOjtLocal()) {
    let rows = [...readOjtStore().plans];
    if (filters?.year) rows = rows.filter((p) => p.year === filters.year);
    if (filters?.departmentId) rows = rows.filter((p) => p.departmentId === filters.departmentId);
    return rows.sort((a, b) => a.trainingTopic.localeCompare(b.trainingTopic));
  }

  const constraints = [];
  if (filters?.departmentId) constraints.push(where("departmentId", "==", filters.departmentId));
  if (filters?.year) constraints.push(where("year", "==", filters.year));
  const q =
    constraints.length > 0
      ? query(collection(db, COLLECTIONS.ojtPlans), ...constraints)
      : collection(db, COLLECTIONS.ojtPlans);
  const snap = await ojtGetDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...firestoreFields(d) }) as OjtPlan)
    .sort((a, b) => a.trainingTopic.localeCompare(b.trainingTopic));
}

export async function getOjtPlan(id: string): Promise<OjtPlan | null> {
  if (preferOjtLocal()) {
    return readOjtStore().plans.find((p) => p.id === id) || null;
  }
  const snap = await ojtGetDoc(doc(db, COLLECTIONS.ojtPlans, id));
  return snap.exists() ? ({ id: snap.id, ...firestoreFields(snap) } as OjtPlan) : null;
}

export async function upsertOjtPlan(
  data: Partial<OjtPlan> & {
    year: number;
    departmentId: string;
    topicId: string;
  },
  actor: OjtActor
): Promise<OjtPlan> {
  const topic = await getOjtTopic(data.topicId);
  if (!topic) throw new Error("OJT topic not found");
  if (!topic.isActive && !data.id) throw new Error("Cannot plan an inactive OJT topic");

  const settings = await getOjtSettings();
  const existing =
    data.id
      ? await getOjtPlan(data.id)
      : (await listOjtPlans({ year: data.year, departmentId: data.departmentId })).find(
          (p) => p.topicId === data.topicId
        );

  const now = nowISO();
  const plan: OjtPlan = {
    requireEmployeeAck: settings.requireEmployeeAck,
    requireTrainerSignoff: settings.requireTrainerSignoff,
    requireHodVerification: settings.requireHodVerification,
    requireQaApproval: settings.requireQaApproval,
    selectionMonths: [],
    executionMonths: [],
    employeeSelections: [],
    status: "planned",
    sopId: topic.sopId,
    sopNumber: topic.sopNumber,
    referenceDocumentNumber: topic.referenceDocumentNumber || topic.sopNumber || "NA",
    departmentName: topic.departmentName,
    ...existing,
    ...data,
    id: existing?.id || generateId("ojt_plan"),
    trainingTopic: data.trainingTopic || existing?.trainingTopic || topic.trainingTopic,
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || actor.uid,
    updatedAt: now,
    updatedBy: actor.uid,
  };
  await savePlan(plan);
  await audit({
    action: existing ? "update" : "create",
    resourceType: "ojt_plan",
    resourceId: plan.id,
    description: `${existing ? "Updated" : "Created"} OJT planner row ${plan.trainingTopic} (${plan.year})`,
    after: {
      year: plan.year,
      selectionMonths: plan.selectionMonths,
      executionMonths: plan.executionMonths,
    },
  });
  return plan;
}

export async function seedPlannerFromTopics(
  year: number,
  department: { id: string; name: string },
  actor: OjtActor
): Promise<OjtPlan[]> {
  const topics = (await listOjtTopics(department.id)).filter((t) => t.isActive);
  const plans: OjtPlan[] = [];
  for (const topic of topics) {
    plans.push(
      await upsertOjtPlan(
        {
          year,
          departmentId: department.id,
          departmentName: department.name,
          topicId: topic.id,
        },
        actor
      )
    );
  }
  return plans;
}

export async function listOjtAssignments(
  filters?: OjtAssignmentFilters
): Promise<OjtAssignment[]> {
  if (preferOjtLocal()) {
    return applyAssignmentFilters(
      [...readOjtStore().assignments],
      filters
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const col = collection(db, COLLECTIONS.ojtAssignments);
  let snap;
  if (filters?.employeeId) {
    snap = await ojtGetDocs(query(col, where("employeeId", "==", filters.employeeId)));
  } else if (filters?.trainerId) {
    snap = await ojtGetDocs(query(col, where("trainerId", "==", filters.trainerId)));
  } else if (filters?.departmentId && filters?.year) {
    snap = await ojtGetDocs(
      query(col, where("departmentId", "==", filters.departmentId), where("year", "==", filters.year))
    );
  } else if (filters?.departmentId) {
    snap = await ojtGetDocs(query(col, where("departmentId", "==", filters.departmentId)));
  } else if (filters?.year) {
    snap = await ojtGetDocs(query(col, where("year", "==", filters.year)));
  } else {
    snap = await ojtGetDocs(col);
  }
  return applyAssignmentFilters(
    snap.docs.map((d) => ({ id: d.id, ...firestoreFields(d) }) as OjtAssignment),
    filters
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOjtAssignment(id: string): Promise<OjtAssignment | null> {
  if (preferOjtLocal()) {
    return readOjtStore().assignments.find((a) => a.id === id) || null;
  }
  const snap = await ojtGetDoc(doc(db, COLLECTIONS.ojtAssignments, id));
  return snap.exists() ? ({ id: snap.id, ...firestoreFields(snap) } as OjtAssignment) : null;
}

function defaultMonths(plan: OjtPlan): { selectionMonth: number; plannedExecutionMonth: number } {
  const selectionMonth = plan.selectionMonths[0] || currentCalendarMonth();
  const plannedExecutionMonth = plan.executionMonths[0] || selectionMonth;
  return { selectionMonth, plannedExecutionMonth };
}

export async function createOjtAssignmentForEmployee(params: {
  plan: OjtPlan;
  employee: Employee;
  actor: OjtActor;
  trainerId?: string;
  trainerName?: string;
  selectionMonth?: number;
  plannedExecutionMonth?: number;
  remarks?: string;
}): Promise<OjtAssignment> {
  const existing = (await listOjtAssignments({
    employeeId: params.employee.id,
    topicId: params.plan.topicId,
    year: params.plan.year,
  })).find((a) => a.status !== "cancelled" && a.status !== "completed" && a.status !== "failed");
  if (existing) return existing;

  const topic = await getOjtTopic(params.plan.topicId);
  if (!topic) throw new Error("OJT topic not found");

  let sopSnap: Partial<CurrentSopSnapshot> = {
    sopId: params.plan.sopId,
    sopNumber: params.plan.sopNumber,
  };
  if (topic.sopId) {
    sopSnap = await resolveCurrentSopSnapshot(topic.sopId);
  }

  const months = defaultMonths(params.plan);
  const now = nowISO();
  const hodUserId = await departmentHeadUserId(
    params.employee.departmentId || params.plan.departmentId
  );
  const assignment: OjtAssignment = {
    id: generateId("ojt_asg"),
    planId: params.plan.id,
    topicId: params.plan.topicId,
    trainingTopic: params.plan.trainingTopic,
    employeeId: params.employee.id,
    employeeCode: params.employee.employeeCode,
    employeeName: `${params.employee.firstName} ${params.employee.lastName}`.trim(),
    departmentId: params.employee.departmentId || params.plan.departmentId,
    departmentName: params.employee.departmentName || params.plan.departmentName,
    designation: params.employee.designation,
    sopId: sopSnap.sopId,
    sopNumber: sopSnap.sopNumber || params.plan.sopNumber,
    sopVersionId: sopSnap.sopVersionId,
    sopVersionNumber: sopSnap.sopVersionNumber,
    referenceDocumentNumber:
      params.plan.referenceDocumentNumber || sopSnap.sopNumber || topic.referenceDocumentNumber || "NA",
    year: params.plan.year,
    selectionMonth: params.selectionMonth || months.selectionMonth,
    plannedExecutionMonth: params.plannedExecutionMonth || months.plannedExecutionMonth,
    trainerId: params.trainerId || params.plan.trainerId,
    trainerName: params.trainerName || params.plan.trainerName,
    hodUserId,
    responsiblePersonId: params.plan.responsiblePersonId,
    responsiblePersonName: params.plan.responsiblePersonName,
    status: params.trainerId || params.plan.trainerId ? "assigned" : "selected",
    remarks: params.remarks,
    attachments: [],
    attempts: [],
    attemptNumber: 1,
    isRetraining: false,
    requireEmployeeAck: params.plan.requireEmployeeAck,
    requireTrainerSignoff: params.plan.requireTrainerSignoff,
    requireHodVerification: params.plan.requireHodVerification,
    requireQaApproval: params.plan.requireQaApproval,
    createdAt: now,
    updatedAt: now,
    createdBy: params.actor.uid,
  };
  await saveAssignment(assignment);
  await safeNotify(() =>
    notifyEmployee({
      employeeId: assignment.employeeId,
      type: "ojt",
      title: "OJT assigned",
      message: `You have been selected for On Job Training: ${assignment.trainingTopic}`,
      link: `/dashboard/ojt/assignments/${assignment.id}`,
      actorId: params.actor.uid,
    })
  );
  if (assignment.trainerId) {
    await safeNotify(() =>
      createNotification({
        userId: assignment.trainerId!,
        type: "ojt",
        title: "OJT trainer assignment",
        message: `${assignment.employeeName} — ${assignment.trainingTopic}`,
        link: `/dashboard/ojt/assignments/${assignment.id}`,
        actorId: params.actor.uid,
      })
    );
  }
  await audit({
    action: "assign",
    resourceType: "ojt_assignment",
    resourceId: assignment.id,
    description: `Selected ${assignment.employeeName} for OJT ${assignment.trainingTopic}`,
    after: {
      employeeId: assignment.employeeId,
      topicId: assignment.topicId,
      sopVersionId: assignment.sopVersionId,
    },
  });
  return assignment;
}

export async function setPlanEmployeeApplicability(params: {
  planId: string;
  employee: Employee;
  applicability: OjtApplicability | "not_set";
  actor: OjtActor;
  trainerId?: string;
  trainerName?: string;
}): Promise<{ plan: OjtPlan; assignment: OjtAssignment | null }> {
  const plan = await getOjtPlan(params.planId);
  if (!plan) throw new Error("OJT planner row not found");

  if (
    params.employee.departmentId &&
    params.employee.departmentId !== plan.departmentId &&
    params.actor.role !== "super_admin" &&
    params.actor.role !== "qa"
  ) {
    throw new Error("Employee does not belong to the selected department");
  }

  const selections = plan.employeeSelections.filter((s) => s.employeeId !== params.employee.id);
  if (params.applicability !== "not_set") {
    selections.push({
      employeeId: params.employee.id,
      employeeCode: params.employee.employeeCode,
      employeeName: `${params.employee.firstName} ${params.employee.lastName}`.trim(),
      applicability: params.applicability,
    });
  }

  const nextPlan = await upsertOjtPlan(
    { ...plan, employeeSelections: selections, year: plan.year, departmentId: plan.departmentId, topicId: plan.topicId },
    params.actor
  );

  let assignment: OjtAssignment | null = null;
  if (params.applicability === "selected") {
    assignment = await createOjtAssignmentForEmployee({
      plan: nextPlan,
      employee: params.employee,
      actor: params.actor,
      trainerId: params.trainerId,
      trainerName: params.trainerName,
    });
  } else {
    const open = (await listOjtAssignments({
      employeeId: params.employee.id,
      topicId: plan.topicId,
      year: plan.year,
    })).find((a) => ["selected", "draft", "assigned"].includes(a.status));
    if (open) {
      assignment = await cancelOjtAssignment(open.id, params.actor, "Marked not applicable on training matrix");
    }
  }

  await audit({
    action: "update",
    resourceType: "ojt_plan",
    resourceId: plan.id,
    description: `Matrix cell ${params.employee.employeeCode} → ${params.applicability}`,
    after: { employeeId: params.employee.id, applicability: params.applicability },
  });

  return { plan: nextPlan, assignment };
}

export async function scheduleOjtAssignment(
  id: string,
  data: {
    executionDate: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    trainerId: string;
    trainerName?: string;
    remarks?: string;
  },
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  if (!data.trainerId) throw new Error("Trainer is required before scheduling");
  const executionDate = calendarDateToIso(data.executionDate);
  if (!dateFallsInPlannedMonth(executionDate, assignment.year, assignment.plannedExecutionMonth)) {
    throw new Error("Execution date should fall in the planned execution month");
  }
  if (assignment.sopId) {
    await resolveCurrentSopSnapshot(assignment.sopId);
  }
  const nextStatus = assignment.status === "rescheduled" ? "scheduled" : "scheduled";
  assertTransition(assignment.status, nextStatus);
  const next: OjtAssignment = {
    ...assignment,
    actualExecutionDate: executionDate,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    trainerId: data.trainerId,
    trainerName: data.trainerName,
    remarks: data.remarks ?? assignment.remarks,
    status: nextStatus,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await safeNotify(() =>
    notifyEmployee({
      employeeId: next.employeeId,
      type: "ojt",
      title: "OJT scheduled",
      message: `${next.trainingTopic} is scheduled for ${executionDate.slice(0, 10)}`,
      link: `/dashboard/ojt/assignments/${next.id}`,
      actorId: actor.uid,
    })
  );
  if (next.trainerId) {
    await safeNotify(() =>
      createNotification({
        userId: next.trainerId!,
        type: "ojt",
        title: "OJT scheduled",
        message: `${next.employeeName} — ${next.trainingTopic}`,
        link: `/dashboard/ojt/execution/${next.id}`,
        actorId: actor.uid,
      })
    );
  }
  await audit({
    action: "update",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Scheduled OJT for ${assignment.employeeName}`,
    before: { status: assignment.status },
    after: { status: next.status, actualExecutionDate: next.actualExecutionDate },
  });
  return next;
}

function dateFallsInPlannedMonth(isoDate: string, year: number, month: number): boolean {
  return dateFallsInMonth(isoDate, year, month);
}

export async function startOjtExecution(id: string, actor: OjtActor): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  assertTrainer(assignment, actor);
  assertTransition(assignment.status, "in_progress");
  const next: OjtAssignment = {
    ...assignment,
    status: "in_progress",
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await audit({
    action: "update",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Started OJT execution for ${assignment.employeeName}`,
    before: { status: assignment.status },
    after: { status: "in_progress" },
  });
  return next;
}

export async function recordOjtExecution(
  id: string,
  data: {
    actualExecutionDate?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    practicalActivity?: string;
    trainingDetails?: string;
    observations?: string;
    employeePerformance?: string;
    trainerRemarks?: string;
  },
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  assertTrainer(assignment, actor);
  if (assignment.status === "scheduled" || assignment.status === "rescheduled") {
    assertTransition(assignment.status, "in_progress");
  }
  const next: OjtAssignment = {
    ...assignment,
    ...data,
    actualExecutionDate: data.actualExecutionDate
      ? calendarDateToIso(data.actualExecutionDate)
      : assignment.actualExecutionDate,
    status: assignment.status === "scheduled" || assignment.status === "rescheduled" ? "in_progress" : assignment.status,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await audit({
    action: "update",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Recorded practical OJT details for ${assignment.employeeName}`,
  });
  return next;
}

export async function submitOjtEvaluation(
  id: string,
  evaluation: OjtEvaluation,
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  assertTrainer(assignment, actor);
  if (!assignment.actualExecutionDate) {
    throw new Error("Execution date is required before evaluation");
  }
  const passed = evaluation.overallResult === "pass";
  const working: OjtAssignment = {
    ...assignment,
    status:
      assignment.status === "scheduled" || assignment.status === "rescheduled"
        ? "in_progress"
        : assignment.status,
  };
  if (working.status !== assignment.status) {
    assertTransition(assignment.status, "in_progress");
  }
  const nextStatus = statusAfterTrainerCompletion(working, passed);
  assertTransition(working.status, nextStatus);
  const attempt = {
    id: generateId("ojt_att"),
    attemptNumber: assignment.attemptNumber || 1,
    status: nextStatus,
    trainerId: actor.uid,
    trainerName: actor.name,
    executionDate: assignment.actualExecutionDate,
    evaluation,
    outcome: passed ? ("passed" as const) : ("failed" as const),
    failureReason: passed ? undefined : evaluation.comments,
    remarks: evaluation.comments,
    createdAt: nowISO(),
  };
  const next: OjtAssignment = {
    ...working,
    evaluation: { ...evaluation, evaluatedBy: actor.uid, evaluatedByName: actor.name, evaluatedAt: nowISO() },
    overallCompetency: passed ? "competent" : "not_competent",
    status: nextStatus,
    failureReason: passed ? undefined : evaluation.comments || assignment.failureReason,
    attempts: [...(assignment.attempts || []), attempt],
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await safeNotify(() =>
    notifyEmployee({
      employeeId: next.employeeId,
      type: passed ? "ojt" : "retraining",
      title: passed ? "OJT evaluation recorded" : "OJT failed — retraining required",
      message: passed
        ? `Trainer evaluation submitted for ${next.trainingTopic}`
        : `You did not demonstrate competency for ${next.trainingTopic}. Retraining will be scheduled.`,
      link: `/dashboard/ojt/assignments/${next.id}`,
      actorId: actor.uid,
    })
  );
  await notifyOjtApproverQueue(next, actor);
  await audit({
    action: "submit",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `OJT evaluation ${evaluation.overallResult} for ${assignment.employeeName}`,
    after: { overallResult: evaluation.overallResult, status: next.status },
  });
  return next;
}

export async function trainerSignOffOjt(
  id: string,
  comments: string,
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  assertTrainer(assignment, actor);
  if (!assignment.evaluation) throw new Error("Evaluation is required before trainer sign-off");
  const passed = assignment.evaluation.overallResult === "pass";
  const nextStatus = statusAfterTrainerCompletion(assignment, passed);
  if (assignment.status !== nextStatus) {
    assertTransition(assignment.status, nextStatus);
  }
  const next: OjtAssignment = {
    ...assignment,
    trainerRemarks: comments || assignment.trainerRemarks,
    trainerSignoff: {
      signed: true,
      decision: passed ? "approved" : "rejected",
      comments,
      signedAt: nowISO(),
      userId: actor.uid,
      userName: actor.name,
      role: actor.role,
      signatureDataUrl: actor.digitalSignatureUrl,
    },
    status: nextStatus,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  if (next.status === "trainer_completed") {
    await safeNotify(() =>
      notifyEmployee({
        employeeId: next.employeeId,
        type: "ojt",
        title: "OJT acknowledgement pending",
        message: `Please acknowledge On Job Training: ${next.trainingTopic}`,
        link: `/dashboard/ojt/assignments/${next.id}`,
        actorId: actor.uid,
      })
    );
  }
  await notifyOjtApproverQueue(next, actor);
  await audit({
    action: "sign",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Trainer signed off OJT for ${assignment.employeeName}`,
    after: { status: next.status },
  });
  return next;
}

export async function acknowledgeOjt(
  id: string,
  actor: OjtActor,
  statement = OJT_ACK_STATEMENT
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  if (actor.role === "employee" && actor.employeeId !== assignment.employeeId) {
    throw new Error("You may only acknowledge your own OJT");
  }
  if (assignment.status !== "trainer_completed") {
    throw new Error("OJT is not ready for employee acknowledgement");
  }
  const nextStatus = statusAfterEmployeeAck(assignment);
  assertTransition(assignment.status, nextStatus);
  const next: OjtAssignment = {
    ...assignment,
    acknowledgement: {
      acknowledged: true,
      statement,
      acknowledgedAt: nowISO(),
      userId: actor.uid,
      userName: actor.name,
      employeeId: assignment.employeeId,
      signatureDataUrl: actor.digitalSignatureUrl,
    },
    status: nextStatus,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await notifyOjtApproverQueue(next, actor);
  await audit({
    action: "sign",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `${assignment.employeeName} acknowledged OJT ${assignment.trainingTopic}`,
    after: { status: next.status },
  });
  return next;
}

export async function verifyOjtByHod(
  id: string,
  decision: "approved" | "rejected",
  comments: string,
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  if (actor.role !== "department_head" && actor.role !== "super_admin" && actor.role !== "qa") {
    throw new Error("HOD / designee verification is required");
  }
  if (assignment.status !== "verification_pending") {
    throw new Error("OJT is not pending HOD verification");
  }
  const nextStatus = statusAfterHodDecision(assignment, decision);
  assertTransition(assignment.status, nextStatus);
  const next: OjtAssignment = {
    ...assignment,
    hodVerification: {
      signed: true,
      decision,
      comments,
      signedAt: nowISO(),
      userId: actor.uid,
      userName: actor.name,
      role: actor.role,
      signatureDataUrl: actor.digitalSignatureUrl,
    },
    hodUserId: actor.uid,
    hodUserName: actor.name,
    status: nextStatus,
    failureReason: decision === "rejected" ? comments : assignment.failureReason,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await safeNotify(() =>
    notifyEmployee({
      employeeId: next.employeeId,
      type: "ojt",
      title: decision === "approved" ? "OJT verified by HOD" : "OJT rejected by HOD",
      message: `${next.trainingTopic}${comments ? ` — ${comments}` : ""}`,
      link: `/dashboard/ojt/assignments/${next.id}`,
      actorId: actor.uid,
    })
  );
  await notifyOjtApproverQueue(next, actor);
  await audit({
    action: decision === "approved" ? "approve" : "reject",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `HOD/Designee ${decision} OJT for ${assignment.employeeName}`,
    after: { status: next.status, comments },
  });
  return next;
}

export async function approveOjtByQa(
  id: string,
  decision: "approved" | "rejected",
  comments: string,
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  if (actor.role !== "qa" && actor.role !== "super_admin") {
    throw new Error("QA approval is required");
  }
  if (assignment.status !== "qa_pending") {
    throw new Error("OJT is not pending QA approval");
  }
  const nextStatus = decision === "approved" ? "completed" : "failed";
  assertTransition(assignment.status, nextStatus);
  const next: OjtAssignment = {
    ...assignment,
    qaApproval: {
      signed: true,
      decision,
      comments,
      signedAt: nowISO(),
      userId: actor.uid,
      userName: actor.name,
      role: actor.role,
      signatureDataUrl: actor.digitalSignatureUrl,
    },
    qaVerifierId: actor.uid,
    qaVerifierName: actor.name,
    status: nextStatus,
    overallCompetency: decision === "approved" ? "competent" : "not_competent",
    failureReason: decision === "rejected" ? comments : assignment.failureReason,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await safeNotify(() =>
    notifyEmployee({
      employeeId: next.employeeId,
      type: "ojt",
      title: decision === "approved" ? "OJT completed" : "OJT rejected by QA",
      message: `${next.trainingTopic}`,
      link: `/dashboard/ojt/assignments/${next.id}`,
      actorId: actor.uid,
    })
  );
  await audit({
    action: decision === "approved" ? "approve" : "reject",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `QA ${decision} OJT for ${assignment.employeeName}`,
    after: { status: next.status },
  });
  return next;
}

export async function markRetrainingRequired(
  id: string,
  reason: string,
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  assertTransition(assignment.status, "retraining_required");
  const next: OjtAssignment = {
    ...assignment,
    status: "retraining_required",
    failureReason: reason,
    overallCompetency: "not_competent",
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await safeNotify(() =>
    notifyEmployee({
      employeeId: next.employeeId,
      type: "retraining",
      title: "OJT retraining required",
      message: reason,
      link: `/dashboard/ojt/assignments/${next.id}`,
      actorId: actor.uid,
    })
  );
  await audit({
    action: "reassign",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Retraining required for ${assignment.employeeName}`,
    after: { reason },
  });
  return next;
}

export async function rescheduleRetraining(
  id: string,
  data: {
    retrainingDate: string;
    trainerId?: string;
    trainerName?: string;
    remarks?: string;
  },
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  if (assignment.status === "failed") {
    assertTransition(assignment.status, "retraining_required");
    assignment.status = "retraining_required";
  }
  assertTransition(assignment.status, "rescheduled");
  const retrainingDate = calendarDateToIso(data.retrainingDate);
  const dateParts = parseCalendarDateParts(retrainingDate);
  if (assignment.sopId) {
    const snap = await resolveCurrentSopSnapshot(assignment.sopId);
    assignment.sopVersionId = snap.sopVersionId;
    assignment.sopVersionNumber = snap.sopVersionNumber;
  }
  const next: OjtAssignment = {
    ...assignment,
    status: "rescheduled",
    isRetraining: true,
    attemptNumber: (assignment.attemptNumber || 1) + 1,
    retrainingDate,
    actualExecutionDate: retrainingDate,
    plannedExecutionMonth: dateParts?.month || assignment.plannedExecutionMonth,
    year: dateParts?.year || assignment.year,
    trainerId: data.trainerId || assignment.trainerId,
    trainerName: data.trainerName || assignment.trainerName,
    remarks: data.remarks || assignment.remarks,
    acknowledgement: undefined,
    trainerSignoff: undefined,
    hodVerification: undefined,
    qaApproval: undefined,
    evaluation: undefined,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await safeNotify(() =>
    notifyEmployee({
      employeeId: next.employeeId,
      type: "retraining",
      title: "OJT retraining scheduled",
      message: `${next.trainingTopic} retraining on ${retrainingDate.slice(0, 10)}`,
      link: `/dashboard/ojt/assignments/${next.id}`,
      actorId: actor.uid,
    })
  );
  await audit({
    action: "reassign",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Rescheduled retraining attempt ${next.attemptNumber} for ${assignment.employeeName}`,
    after: { attemptNumber: next.attemptNumber, retrainingDate: data.retrainingDate },
  });
  return next;
}

export async function cancelOjtAssignment(
  id: string,
  actor: OjtActor,
  reason: string
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  assertTransition(assignment.status, "cancelled");
  const next: OjtAssignment = {
    ...assignment,
    status: "cancelled",
    remarks: reason || assignment.remarks,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await audit({
    action: "update",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Cancelled OJT for ${assignment.employeeName}`,
    after: { reason },
  });
  return next;
}

export async function assignOjtTrainer(
  id: string,
  trainerId: string,
  trainerName: string,
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  const nextStatus =
    assignment.status === "selected" || assignment.status === "draft" ? "assigned" : assignment.status;
  if (nextStatus !== assignment.status) assertTransition(assignment.status, nextStatus);
  const next: OjtAssignment = {
    ...assignment,
    trainerId,
    trainerName,
    status: nextStatus,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await safeNotify(() =>
    createNotification({
      userId: trainerId,
      type: "ojt",
      title: "OJT trainer assigned",
      message: `${next.employeeName} — ${next.trainingTopic}`,
      link: `/dashboard/ojt/assignments/${next.id}`,
      actorId: actor.uid,
    })
  );
  await audit({
    action: "assign",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Trainer ${trainerName} assigned to OJT ${assignment.trainingTopic}`,
    before: { trainerId: assignment.trainerId },
    after: { trainerId },
  });
  return next;
}

function assertTrainer(assignment: OjtAssignment, actor: OjtActor) {
  if (actor.role === "super_admin" || actor.role === "qa" || actor.role === "department_head") return;
  if (actor.role === "trainer" && (assignment.trainerId === actor.uid || assignment.createdBy === actor.uid)) {
    return;
  }
  throw new Error("Only the assigned trainer can execute this OJT");
}

export async function uploadOjtAttachment(params: {
  assignmentId: string;
  file: File;
  kind: OjtAttachmentKind;
  actor: OjtActor;
}): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(params.assignmentId);
  if (!assignment) throw new Error("OJT assignment not found");
  const attId = generateId("ojt_attf");
  const storagePath = `ojt/${assignment.id}/${attId}_${params.file.name}`;
  let downloadUrl = "";
  if (isDemoMode() || preferOjtLocal()) {
    downloadUrl = URL.createObjectURL(params.file);
  } else {
    await uploadBytes(ref(storage, storagePath), params.file, { contentType: params.file.type });
    downloadUrl = await getDownloadURL(ref(storage, storagePath));
  }
  const attachment: OjtAttachment = {
    id: attId,
    fileName: params.file.name,
    storagePath,
    downloadUrl,
    fileType: params.file.type || "application/octet-stream",
    fileSize: params.file.size,
    uploadedBy: params.actor.uid,
    uploadedByName: params.actor.name,
    uploadedAt: nowISO(),
    kind: params.kind,
  };
  const next: OjtAssignment = {
    ...assignment,
    attachments: [...(assignment.attachments || []), attachment],
    updatedAt: nowISO(),
    updatedBy: params.actor.uid,
  };
  await saveAssignment(next);
  await audit({
    action: "upload",
    resourceType: "ojt_assignment",
    resourceId: assignment.id,
    description: `Uploaded ${params.file.name} to OJT ${assignment.trainingTopic}`,
    after: { fileName: params.file.name, kind: params.kind },
  });
  return next;
}

export async function deleteOjtAttachment(
  assignmentId: string,
  attachmentId: string,
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(assignmentId);
  if (!assignment) throw new Error("OJT assignment not found");
  const att = assignment.attachments.find((a) => a.id === attachmentId);
  if (!att) throw new Error("Attachment not found");
  if (!preferOjtLocal() && !isDemoMode() && att.storagePath && !att.storagePath.startsWith("demo/")) {
    try {
      await deleteObject(ref(storage, att.storagePath));
    } catch {
      /* ignore missing storage object */
    }
  }
  const next: OjtAssignment = {
    ...assignment,
    attachments: assignment.attachments.filter((a) => a.id !== attachmentId),
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  await audit({
    action: "delete",
    resourceType: "ojt_assignment",
    resourceId: assignmentId,
    description: `Deleted attachment ${att.fileName}`,
    before: { fileName: att.fileName },
  });
  return next;
}

export async function buildOjtDashboardStats(
  assignments: OjtAssignment[],
  topics: OjtTopic[],
  graceDays = 0
): Promise<OjtDashboardStats> {
  const month = currentCalendarMonth();
  const year = currentCalendarYear();
  const overdue = assignments.filter((a) => isOjtOverdue(a, new Date(), graceDays)).length;
  const completed = assignments.filter((a) => a.status === "completed").length;
  const totalAssigned = assignments.filter((a) => a.status !== "cancelled").length;
  return {
    totalTopics: topics.filter((t) => t.isActive).length,
    totalAssigned,
    planned: assignments.filter((a) => a.status === "selected" || a.status === "assigned").length,
    thisMonth: assignments.filter(
      (a) => a.year === year && a.plannedExecutionMonth === month && a.status !== "cancelled"
    ).length,
    scheduled: assignments.filter((a) => a.status === "scheduled" || a.status === "rescheduled").length,
    inProgress: assignments.filter((a) =>
      ["in_progress", "trainer_completed", "employee_acknowledged", "verification_pending", "qa_pending"].includes(
        a.status
      )
    ).length,
    completed,
    pending: assignments.filter((a) =>
      ["draft", "selected", "assigned", "scheduled", "rescheduled"].includes(a.status)
    ).length,
    failed: assignments.filter((a) => a.status === "failed").length,
    retrainingRequired: assignments.filter((a) => a.status === "retraining_required").length,
    overdue,
    cancelled: assignments.filter((a) => a.status === "cancelled").length,
    completionPercent: totalAssigned ? Math.round((completed / totalAssigned) * 100) : 0,
  };
}

export async function listOjtStaffOptions(): Promise<
  { uid: string; displayName: string; role: OjtActor["role"] }[]
> {
  const users = await listUsersByRoles(["trainer", "department_head", "qa", "hr"]).catch(() => []);
  return users.map((u) => ({
    uid: u.uid,
    displayName: u.displayName,
    role: u.role,
  }));
}

export { currentCalendarYear, currentCalendarMonth };
