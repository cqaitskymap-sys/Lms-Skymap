/**
 * On Job Training service — topics, yearly planner, employee matrix,
 * assignments, practical execution, evaluation, acknowledgements, approvals.
 * Firestore when available; local demo store otherwise.
 */

import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore/lite";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { assertAllowedUpload, isTrainingEvidence, sanitizeStorageFileName } from "@/lib/uploads/safe-file";
import { db, storage, COLLECTIONS } from "@/lib/firebase/client";
import type { Employee, SopDocument, SopVersion, TrainingAssignment } from "@/types";
import type {
  OjtActor,
  OjtApplicability,
  OjtAssignment,
  OjtAttachment,
  OjtAttachmentKind,
  OjtDashboardStats,
  OjtEvaluation,
  OjtEvaluationCriterion,
  OjtExecutionDeviation,
  OjtFormDocument,
  OjtFormKind,
  OjtFormSignoffRole,
  OjtPlan,
  OjtSettings,
  OjtStatus,
  OjtTopic,
} from "@/types/ojt";
import { generateId, nowISO, stripUndefined } from "@/lib/services/helpers";
import {
  DEFAULT_EVALUATION_CRITERIA,
  DEFAULT_OJT_SETTINGS,
  OJT_ACK_STATEMENT,
  assertExecutionNotBeforeSelection,
  calendarDateToIso,
  currentCalendarMonth,
  currentCalendarYear,
  dateFallsInMonth,
  formatRevisionNumber,
  nextRevisionNumber,
  OJT_FORM_SIGNOFF_LABELS,
  parseCalendarDateParts,
} from "@/lib/ojt/constants";
import {
  assertTransition,
  evaluationDidFail,
  evaluationOverallRating,
  isOjtOverdue,
  plannedExecutionMonthsOf,
  statusAfterEmployeeAck,
  statusAfterHodDecision,
  statusAfterQaDecision,
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
import {
  assertFormUnlocked,
  canApproveForm,
  canSignFormRole,
  emptyFormDocument,
  formApprovalsFor,
  formAssignee,
  formDocumentId,
  hasAcceptedSignoff,
  mergeOjtSettings,
  requiredRolesForApproval,
  statusAfterFormSignoff,
} from "@/lib/ojt/forms";
import { getSopBundle, listSopsDetailed } from "@/lib/services/sops";
import { createNotification, notifyEmployee } from "@/lib/services/notifications";
import { recordAuditEvent } from "@/lib/services/audit-logs";
import { isDemoMode } from "@/lib/demo/data";
import {
  assertFirestoreReadsOpen,
  isResourceExhausted,
  noteFirestoreExhausted,
} from "@/lib/firebase/read-gate";

function firestoreFields(snap: { data: () => unknown }): Record<string, unknown> {
  const data = snap.data();
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

function sanitize<T>(value: T): T {
  return stripUndefined(JSON.parse(JSON.stringify(value)) as T);
}

function cloneRow<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPermissionDenied(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  return code === "permission-denied" || /insufficient permissions/i.test(String(err));
}

const READ_CACHE_MS = 20_000;
const readCache = new Map<string, { at: number; value: unknown }>();
const readInflight = new Map<string, Promise<unknown>>();

function takeCache<T>(key: string): T | undefined {
  const hit = readCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > READ_CACHE_MS) {
    readCache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function putCache(key: string, value: unknown) {
  readCache.set(key, { at: Date.now(), value });
}

function dropCache(prefix: string) {
  for (const key of readCache.keys()) {
    if (key.startsWith(prefix)) readCache.delete(key);
  }
}

async function cachedRead<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = takeCache<T>(key);
  if (hit !== undefined) return hit;
  const pending = readInflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const promise = loader()
    .then((value) => {
      putCache(key, value);
      readInflight.delete(key);
      return value;
    })
    .catch((err) => {
      readInflight.delete(key);
      throw err;
    });
  readInflight.set(key, promise);
  return promise;
}

function rethrowOjtPermission(err: unknown, collectionHint?: string): never {
  if (isResourceExhausted(err)) {
    throw new Error(
      "Firestore is rate-limiting OJT reads. Wait a minute, then reload. Month ticks are saved together so this plan is not read again on every click."
    );
  }
  if (isPermissionDenied(err)) {
    throw new Error(
      collectionHint
        ? `OJT Firestore collection "${collectionHint}" is blocked by live security rules. Deploy this repo's firestore.rules to lms-skymap.`
        : "OJT Firestore collections are blocked. Live rules on lms-skymap do not include ojt_topics / ojt_assignments. From this repo run: npx firebase-tools deploy --only firestore:rules,firestore:indexes --project lms-skymap"
    );
  }
  throw err;
}

async function ojtGetDocs(
  q: Parameters<typeof getDocs>[0]
): Promise<Awaited<ReturnType<typeof getDocs>>> {
  try {
    assertFirestoreReadsOpen();
    return await getDocs(q);
  } catch (err) {
    noteFirestoreExhausted(err);
    return rethrowOjtPermission(err);
  }
}

async function ojtGetDoc(
  ref: Parameters<typeof getDoc>[0]
): Promise<Awaited<ReturnType<typeof getDoc>>> {
  try {
    assertFirestoreReadsOpen();
    return await getDoc(ref);
  } catch (err) {
    noteFirestoreExhausted(err);
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

async function ojtDeleteDoc(path: Parameters<typeof deleteDoc>[0]) {
  try {
    await deleteDoc(path);
  } catch (err) {
    return rethrowOjtPermission(err);
  }
}

function assertOjtSuperAdmin(actor: OjtActor) {
  if (actor.role !== "super_admin") {
    throw new Error("Only Super Admin can edit or delete OJT records");
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
      const hodId =
        (await departmentHeadUserId(assignment.departmentId)) || assignment.hodUserId;
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
  putCache(`ojt_topics/${topic.id}`, topic);
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
  putCache(`ojt_plans/${plan.id}`, plan);
  dropCache("ojt_plans_list/");
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

/** Append one file without replacing the assignment document. */
async function appendAssignmentAttachment(
  assignment: OjtAssignment,
  attachment: OjtAttachment,
  actorId: string
): Promise<OjtAssignment> {
  const now = nowISO();
  if (preferOjtLocal()) {
    const store = readOjtStore();
    const idx = store.assignments.findIndex((a) => a.id === assignment.id);
    if (idx < 0) throw new Error("OJT assignment not found");
    const current = store.assignments[idx];
    const next: OjtAssignment = {
      ...current,
      attachments: [...(current.attachments || []), attachment],
      updatedAt: now,
      updatedBy: actorId,
    };
    store.assignments[idx] = next;
    writeOjtStore(store);
    return next;
  }
  try {
    await updateDoc(doc(db, COLLECTIONS.ojtAssignments, assignment.id), {
      attachments: arrayUnion(sanitize(attachment)),
      updatedAt: now,
      updatedBy: actorId,
    });
  } catch (err) {
    return rethrowOjtPermission(err, COLLECTIONS.ojtAssignments);
  }
  notifyOjtUpdated();
  const fresh = await getOjtAssignment(assignment.id);
  return (
    fresh || {
      ...assignment,
      attachments: [...(assignment.attachments || []), attachment],
      updatedAt: now,
      updatedBy: actorId,
    }
  );
}

async function saveFormDocument(docRow: OjtFormDocument): Promise<void> {
  if (preferOjtLocal()) {
    const store = readOjtStore();
    const idx = store.formDocuments.findIndex((d) => d.id === docRow.id);
    if (idx >= 0) store.formDocuments[idx] = docRow;
    else store.formDocuments.push(docRow);
    writeOjtStore(store);
    return;
  }
  try {
    // Use setDoc directly so permission-denied can fall back to the local store.
    await setDoc(doc(db, COLLECTIONS.ojtFormDocuments, docRow.id), sanitize(docRow));
    putCache(`ojt_forms/${docRow.id}`, docRow);
    notifyOjtUpdated();
  } catch (err) {
    if (!isPermissionDenied(err)) return rethrowOjtPermission(err, COLLECTIONS.ojtFormDocuments);
    const store = readOjtStore();
    const idx = store.formDocuments.findIndex((d) => d.id === docRow.id);
    if (idx >= 0) store.formDocuments[idx] = docRow;
    else store.formDocuments.push(docRow);
    writeOjtStore(store);
  }
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
    return mergeOjtSettings(readOjtStore().settings ?? fallback);
  }

  return cachedRead("ojt_settings/global", async () => {
    const snap = await ojtGetDoc(doc(db, COLLECTIONS.ojtSettings, "global"));
    if (!snap.exists()) return fallback;
    return mergeOjtSettings({ id: snap.id, ...firestoreFields(snap) } as OjtSettings);
  });
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
    putCache("ojt_settings/global", next);
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
    const row = readOjtStore().topics.find((t) => t.id === id);
    return row ? cloneRow(row) : null;
  }
  return cachedRead(`ojt_topics/${id}`, async () => {
    const snap = await ojtGetDoc(doc(db, COLLECTIONS.ojtTopics, id));
    return snap.exists() ? ({ id: snap.id, ...firestoreFields(snap) } as OjtTopic) : null;
  });
}

type CurrentSopSnapshot = {
  sopId: string;
  sopNumber: string;
  sopTitle?: string;
  sopVersionId: string;
  sopVersionNumber: string;
  sopEffectiveDate?: string;
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
    sopTitle: sop.title,
    sopVersionId: version.id,
    sopVersionNumber: version.versionNumber,
    sopEffectiveDate: version.effectiveDate || sop.effectiveDate,
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
    sopTitle: snapshot.sopTitle || data.sopTitle,
    sopEffectiveDate: snapshot.sopEffectiveDate || snapshot.effectiveDate || data.sopEffectiveDate,
    id: generateId("ojt_topic"),
    trainingType: data.trainingType || "on_job",
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
    createdByName: actor.name,
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
  const unlinkSop = Object.prototype.hasOwnProperty.call(patch, "sopId") && !patch.sopId;
  let snapshot: Partial<CurrentSopSnapshot> = {};
  if (!unlinkSop && patch.sopId && patch.sopId !== existing.sopId) {
    snapshot = await resolveCurrentSopSnapshot(patch.sopId);
  }
  const next: OjtTopic = {
    ...existing,
    ...patch,
    ...snapshot,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
    updatedByName: actor.name,
  };
  if (unlinkSop) {
    delete next.sopId;
    delete next.sopNumber;
    delete next.sopTitle;
    delete next.sopVersionId;
    delete next.sopVersionNumber;
    delete next.sopEffectiveDate;
  }
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

/** Super Admin only — removes the topic and linked planner rows / OJT records. */
export async function deleteOjtTopic(id: string, actor: OjtActor): Promise<void> {
  assertOjtSuperAdmin(actor);
  const topic = await getOjtTopic(id);
  if (!topic) throw new Error("OJT topic not found");

  if (preferOjtLocal()) {
    const store = readOjtStore();
    store.topics = store.topics.filter((t) => t.id !== id);
    store.plans = store.plans.filter((p) => p.topicId !== id);
    store.assignments = store.assignments.filter((a) => a.topicId !== id);
    writeOjtStore(store);
  } else {
    const [plans, assignments] = await Promise.all([
      listOjtPlans(),
      listOjtAssignments({ topicId: id }),
    ]);
    await ojtDeleteDoc(doc(db, COLLECTIONS.ojtTopics, id));
    await Promise.all([
      ...plans
        .filter((p) => p.topicId === id)
        .map((p) => ojtDeleteDoc(doc(db, COLLECTIONS.ojtPlans, p.id))),
      ...assignments.map((a) => ojtDeleteDoc(doc(db, COLLECTIONS.ojtAssignments, a.id))),
    ]);
    notifyOjtUpdated();
  }

  await audit({
    action: "delete",
    resourceType: "ojt_topic",
    resourceId: id,
    description: `Deleted OJT topic ${topic.trainingTopic}`,
    before: { trainingTopic: topic.trainingTopic, departmentId: topic.departmentId },
  });
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
    const payload = {
      trainingTopic: matched?.title || seed.trainingTopic,
      description: "Imported from QA On Job Training matrix",
      departmentId: department.id,
      departmentName: department.name,
      sopId: matched?.id,
      sopNumber: matched?.sopNumber || seed.sopNumber,
      sopTitle: matched?.title,
      referenceDocumentNumber: seed.referenceDocumentNumber || seed.sopNumber || "NA",
    };
    try {
      await createOjtTopic(payload, actor);
      created += 1;
      if (matched) linked += 1;
    } catch (err) {
      // Live SOP may exist without a current approved version — still import the topic.
      if (!payload.sopId) {
        console.warn("[ojt] skipped seed topic", seed.trainingTopic, err);
        continue;
      }
      try {
        await createOjtTopic({ ...payload, sopId: undefined }, actor);
        created += 1;
      } catch (retryErr) {
        console.warn("[ojt] skipped seed topic", seed.trainingTopic, retryErr);
      }
    }
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
    const row = readOjtStore().plans.find((p) => p.id === id);
    return row ? cloneRow(row) : null;
  }
  return cachedRead(`ojt_plans/${id}`, async () => {
    const snap = await ojtGetDoc(doc(db, COLLECTIONS.ojtPlans, id));
    return snap.exists() ? ({ id: snap.id, ...firestoreFields(snap) } as OjtPlan) : null;
  });
}

/** Super Admin only — removes a yearly planner row and its OJT records. */
export async function deleteOjtPlan(id: string, actor: OjtActor): Promise<void> {
  assertOjtSuperAdmin(actor);
  const plan = await getOjtPlan(id);
  if (!plan) throw new Error("OJT planner row not found");

  if (preferOjtLocal()) {
    const store = readOjtStore();
    store.plans = store.plans.filter((p) => p.id !== id);
    store.assignments = store.assignments.filter((a) => a.planId !== id);
    writeOjtStore(store);
  } else {
    const assignments = await listOjtAssignments({ planId: id });
    dropCache(`ojt_plans/${id}`);
    dropCache("ojt_plans_list/");
    await ojtDeleteDoc(doc(db, COLLECTIONS.ojtPlans, id));
    await Promise.all(
      assignments.map((a) => ojtDeleteDoc(doc(db, COLLECTIONS.ojtAssignments, a.id)))
    );
    notifyOjtUpdated();
  }

  await audit({
    action: "delete",
    resourceType: "ojt_plan",
    resourceId: id,
    description: `Deleted OJT plan ${plan.trainingTopic} (${plan.year})`,
    before: { trainingTopic: plan.trainingTopic, year: plan.year, departmentId: plan.departmentId },
  });
}

export async function upsertOjtPlan(
  data: Partial<OjtPlan> & {
    year: number;
    departmentId: string;
    topicId: string;
  },
  actor: OjtActor,
  opts?: { allowWhenLocked?: boolean; silent?: boolean }
): Promise<OjtPlan> {
  const topic = await getOjtTopic(data.topicId);
  if (!topic) throw new Error("OJT topic not found");
  if (!topic.isActive && !data.id) throw new Error("Cannot plan an inactive OJT topic");

  const settings = await getOjtSettings();
  const localRow = data.id && data.createdAt ? (data as OjtPlan) : undefined;
  const existing =
    localRow ??
    (data.id
      ? await getOjtPlan(data.id)
      : (await listOjtPlans({ year: data.year, departmentId: data.departmentId })).find(
          (p) => p.topicId === data.topicId
        ));

  if (!opts?.allowWhenLocked) {
    const form = await getOjtFormDocument("planner", data.year, data.departmentId);
    assertFormUnlocked(form, "changing planner months");
  }

  const selectionMonths = data.selectionMonths ?? existing?.selectionMonths ?? [];
  const executionMonths = data.executionMonths ?? existing?.executionMonths ?? [];
  assertExecutionNotBeforeSelection(
    selectionMonths,
    executionMonths,
    settings.allowExecutionBeforeSelection
  );

  const now = nowISO();
  const plan: OjtPlan = {
    requireEmployeeAck: settings.requireEmployeeAck,
    requireTrainerSignoff: settings.requireTrainerSignoff,
    requireHodVerification: settings.requireHodVerification,
    requireQaApproval: settings.requireQaApproval,
    employeeSelections: [],
    status: "planned",
    sopId: topic.sopId,
    sopNumber: topic.sopNumber,
    sopTitle: topic.sopTitle,
    referenceDocumentNumber: topic.referenceDocumentNumber || topic.sopNumber || "NA",
    departmentName: topic.departmentName,
    ...existing,
    ...data,
    selectionMonths,
    executionMonths,
    id: existing?.id || generateId("ojt_plan"),
    trainingTopic: data.trainingTopic || existing?.trainingTopic || topic.trainingTopic,
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || actor.uid,
    updatedAt: now,
    updatedBy: actor.uid,
  };
  if (opts?.silent) {
    if (preferOjtLocal()) {
      await savePlan(plan);
    } else {
      await ojtSetDoc(doc(db, COLLECTIONS.ojtPlans, plan.id), sanitize(plan));
      putCache(`ojt_plans/${plan.id}`, plan);
      dropCache("ojt_plans_list/");
    }
  } else {
    await savePlan(plan);
  }
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
  const existing = await listOjtPlans({ year, departmentId: department.id });
  const plans: OjtPlan[] = [];
  let created = 0;
  for (const topic of topics) {
    const row = existing.find((p) => p.topicId === topic.id);
    if (row) {
      plans.push(row);
      continue;
    }
    plans.push(
      await upsertOjtPlan(
        {
          year,
          departmentId: department.id,
          departmentName: department.name,
          topicId: topic.id,
        },
        actor,
        { silent: true }
      )
    );
    created += 1;
  }
  if (created > 0) notifyOjtUpdated();
  return plans.sort((a, b) => a.trainingTopic.localeCompare(b.trainingTopic));
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
    const row = readOjtStore().assignments.find((a) => a.id === id);
    return row ? cloneRow(row) : null;
  }
  const snap = await ojtGetDoc(doc(db, COLLECTIONS.ojtAssignments, id));
  return snap.exists() ? ({ id: snap.id, ...firestoreFields(snap) } as OjtAssignment) : null;
}

function defaultMonths(
  plan: OjtPlan,
  explicitMonth?: number
): { selectionMonth: number; plannedExecutionMonth: number; plannedExecutionMonths: number[] } {
  const selectionMonth = plan.selectionMonths[0] || currentCalendarMonth();
  const raw = plan.executionMonths.length ? plan.executionMonths : [selectionMonth];
  const plannedExecutionMonths = [
    ...new Set(raw.filter((month) => month >= 1 && month <= 12)),
  ].sort((a, b) => a - b);
  const list = plannedExecutionMonths.length ? plannedExecutionMonths : [selectionMonth];
  if (explicitMonth && explicitMonth >= 1 && explicitMonth <= 12 && !list.includes(explicitMonth)) {
    list.push(explicitMonth);
    list.sort((a, b) => a - b);
  }
  let plannedExecutionMonth = list[0];
  if (explicitMonth && list.includes(explicitMonth)) {
    plannedExecutionMonth = explicitMonth;
  } else if (plan.year < currentCalendarYear()) {
    plannedExecutionMonth = list[list.length - 1];
  } else if (plan.year === currentCalendarYear()) {
    plannedExecutionMonth = list.find((month) => month >= currentCalendarMonth()) || list[list.length - 1];
  }
  return { selectionMonth, plannedExecutionMonth, plannedExecutionMonths: list };
}

const OPEN_SELF_STUDY_TRAINING = new Set([
  "assigned",
  "in_progress",
  "training_scheduled",
  "training_completed",
  "assessment_pending",
  "retraining",
]);

async function ensureOjtSelfStudyTraining(
  assignment: OjtAssignment,
  actorId: string
): Promise<{ trainingAssignmentId?: string; alreadyPassed: boolean }> {
  if (!assignment.sopId) return { alreadyPassed: false };
  const { getEmployeeAssignments } = await import("@/lib/services/training");
  const { isDemoMode } = await import("@/lib/demo/data");
  const {
    preferTrainingLocal,
    readTrainingStore,
    writeTrainingStore,
    notifyTrainingUpdated,
  } = await import("@/lib/training/demo-store");
  const existing = await getEmployeeAssignments(assignment.employeeId);
  const sameSop = existing.filter((row) => row.sopId === assignment.sopId);
  const open = sameSop.find((row) => OPEN_SELF_STUDY_TRAINING.has(row.status));
  if (open) return { trainingAssignmentId: open.id, alreadyPassed: false };
  const passed = sameSop.find((row) => row.status === "passed");
  if (passed) return { trainingAssignmentId: passed.id, alreadyPassed: true };

  let acknowledged = false;
  try {
    const { getEmployee } = await import("@/lib/services/employees");
    const { listAcknowledgementsForUser } = await import("@/lib/services/sops");
    const employee = await getEmployee(assignment.employeeId);
    if (employee?.userId) {
      const acks = await listAcknowledgementsForUser(employee.userId);
      acknowledged = acks.some(
        (ack) =>
          ack.sopId === assignment.sopId &&
          (!assignment.sopVersionId || ack.versionId === assignment.sopVersionId)
      );
    }
  } catch {
    acknowledged = false;
  }

  const now = nowISO();
  const row: TrainingAssignment = {
    id: generateId("ta"),
    employeeId: assignment.employeeId,
    sopId: assignment.sopId,
    sopVersionId: assignment.sopVersionId || "current",
    assignedBy: actorId,
    departmentId: assignment.departmentId,
    status: acknowledged ? "assessment_pending" : "assigned",
    startedAt: acknowledged ? now : undefined,
    trainingCompletedAt: acknowledged ? now : undefined,
    attemptCount: 0,
    isRetraining: false,
    triggeredBySopRevision: false,
    ojtAssignmentId: assignment.id,
    excludeFromCertificate: true,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };
  if (preferTrainingLocal() || isDemoMode()) {
    const store = readTrainingStore();
    store.assignments.push(row);
    writeTrainingStore(store);
  } else {
    await setDoc(doc(db, COLLECTIONS.trainingAssignments, row.id), stripUndefined(row));
  }
  notifyTrainingUpdated();
  return { trainingAssignmentId: row.id, alreadyPassed: false };
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
  const rows = await listOjtAssignments({
    employeeId: params.employee.id,
    topicId: params.plan.topicId,
    year: params.plan.year,
  });
  const existing = rows.find((a) => a.status !== "cancelled");
  if (existing) return existing;

  const stableId = `ojt_asg_${params.plan.year}_${params.plan.topicId}_${params.employee.id}`
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 700);
  const assignmentId = rows.some((a) => a.id === stableId) ? generateId("ojt_asg") : stableId;

  const topic = await getOjtTopic(params.plan.topicId);
  if (!topic) throw new Error("OJT topic not found");

  let sopSnap: Partial<CurrentSopSnapshot> = {
    sopId: params.plan.sopId,
    sopNumber: params.plan.sopNumber,
  };
  if (topic.sopId) {
    sopSnap = await resolveCurrentSopSnapshot(topic.sopId);
  }

  const months = defaultMonths(params.plan, params.plannedExecutionMonth);
  const now = nowISO();
  const hodUserId = await departmentHeadUserId(
    params.employee.departmentId || params.plan.departmentId
  );
  let assignment: OjtAssignment = {
    id: assignmentId,
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
    sopTitle: sopSnap.sopTitle || params.plan.sopTitle || topic.sopTitle,
    sopVersionId: sopSnap.sopVersionId,
    sopVersionNumber: sopSnap.sopVersionNumber,
    sopEffectiveDate: sopSnap.sopEffectiveDate || sopSnap.effectiveDate,
    trainedSopVersionId: sopSnap.sopVersionId,
    trainedSopVersionNumber: sopSnap.sopVersionNumber,
    referenceDocumentNumber:
      params.plan.referenceDocumentNumber || sopSnap.sopNumber || topic.referenceDocumentNumber || "NA",
    year: params.plan.year,
    selectionMonth: params.selectionMonth || months.selectionMonth,
    plannedExecutionMonth: months.plannedExecutionMonth,
    plannedExecutionMonths: months.plannedExecutionMonths,
    selectionDate: now,
    selfStudy: true,
    requireTrainerSignoff: false,
    hodUserId,
    responsiblePersonId: params.plan.responsiblePersonId,
    responsiblePersonName: params.plan.responsiblePersonName,
    status: "in_progress",
    remarks: params.remarks,
    attachments: [],
    attempts: [],
    attemptNumber: 1,
    isRetraining: false,
    requireEmployeeAck: params.plan.requireEmployeeAck,
    requireHodVerification: params.plan.requireHodVerification,
    requireQaApproval: params.plan.requireQaApproval,
    createdAt: now,
    updatedAt: now,
    createdBy: params.actor.uid,
  };
  if (assignment.sopId) {
    const training = await ensureOjtSelfStudyTraining(assignment, params.actor.uid);
    assignment = {
      ...assignment,
      trainingAssignmentId: training.trainingAssignmentId,
      status: training.alreadyPassed ? "completed" : "in_progress",
      overallCompetency: training.alreadyPassed ? "competent" : assignment.overallCompetency,
      actualExecutionDate: training.alreadyPassed ? now.slice(0, 10) : assignment.actualExecutionDate,
      remarks: training.alreadyPassed
        ? "SOP exam was already passed. OJT closed. No certificate is issued for OJT."
        : assignment.remarks,
    };
  }
  await saveAssignment(assignment);
  await safeNotify(() =>
    notifyEmployee({
      employeeId: assignment.employeeId,
      type: "ojt",
      title: "OJT self study",
      message: assignment.sopId
        ? `Log in with your employee ID, read ${assignment.sopNumber || assignment.trainingTopic}, then take the exam. OJT does not issue a certificate.`
        : `Log in with your employee ID and open ${assignment.trainingTopic}. OJT does not issue a certificate.`,
      link: assignment.sopId
        ? `/dashboard/sops/${assignment.sopId}`
        : `/dashboard/ojt/assignments/${assignment.id}`,
      actorId: params.actor.uid,
    })
  );
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

/** Move an existing "needs trainer" row onto self-study. No date or trainer. */
export async function releaseOjtSelfStudy(id: string, actor: OjtActor): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  if (assignment.status === "completed" || assignment.status === "cancelled") return assignment;
  if (assignment.selfStudy && assignment.status === "in_progress" && assignment.trainingAssignmentId) {
    return assignment;
  }
  if (!["draft", "selected", "assigned", "in_progress"].includes(assignment.status)) {
    return assignment;
  }

  const training = await ensureOjtSelfStudyTraining(assignment, actor.uid);
  let status: OjtStatus = assignment.status;
  if (training.alreadyPassed) {
    if (status !== "in_progress") {
      assertTransition(status, "in_progress");
      status = "in_progress";
    }
    assertTransition(status, "completed");
    status = "completed";
  } else if (status !== "in_progress") {
    assertTransition(status, "in_progress");
    status = "in_progress";
  }

  const now = nowISO();
  const next: OjtAssignment = {
    ...assignment,
    selfStudy: true,
    requireTrainerSignoff: false,
    status,
    trainingAssignmentId: training.trainingAssignmentId || assignment.trainingAssignmentId,
    overallCompetency: training.alreadyPassed ? "competent" : assignment.overallCompetency,
    actualExecutionDate: training.alreadyPassed
      ? assignment.actualExecutionDate || now.slice(0, 10)
      : assignment.actualExecutionDate,
    remarks: training.alreadyPassed
      ? "SOP exam was already passed. OJT closed. No certificate is issued for OJT."
      : assignment.remarks,
    updatedAt: now,
    updatedBy: actor.uid,
  };
  await saveAssignment(next);
  if (!training.alreadyPassed) {
    await safeNotify(() =>
      notifyEmployee({
        employeeId: next.employeeId,
        type: "ojt",
        title: "OJT self study",
        message: next.sopId
          ? `Log in with your employee ID, read ${next.sopNumber || next.trainingTopic}, then take the exam. OJT does not issue a certificate.`
          : `Log in with your employee ID and open ${next.trainingTopic}. OJT does not issue a certificate.`,
        link: next.sopId ? `/dashboard/sops/${next.sopId}` : `/dashboard/ojt/assignments/${next.id}`,
        actorId: actor.uid,
      })
    );
  }
  await audit({
    action: "update",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Started self study for ${assignment.employeeName}`,
    before: { status: assignment.status },
    after: { status: next.status, selfStudy: true },
  });
  return next;
}

/** Close self-study OJT when the linked SOP exam is passed or finally failed. */
export async function settleOjtSelfStudyAfterExam(params: {
  employeeId: string;
  sopId?: string;
  ojtAssignmentId?: string;
  passed: boolean;
  finalFail: boolean;
  percentage?: number;
  actorId: string;
}): Promise<void> {
  if (!params.passed && !params.finalFail) return;
  const rows = await listOjtAssignments({ employeeId: params.employeeId });
  for (const assignment of rows) {
    if (!assignment.selfStudy) continue;
    if (assignment.status === "cancelled") continue;
    if (params.passed && assignment.status === "completed") continue;
    if (!params.passed && (assignment.status === "completed" || assignment.status === "failed")) continue;
    const matches =
      (params.ojtAssignmentId && assignment.id === params.ojtAssignmentId) ||
      (params.sopId && assignment.sopId === params.sopId);
    if (!matches) continue;
    const target: OjtStatus = params.passed ? "completed" : "failed";
    const now = nowISO();
    const next: OjtAssignment = {
      ...assignment,
      status: target,
      overallCompetency: params.passed ? "competent" : "not_competent",
      actualExecutionDate: assignment.actualExecutionDate || now.slice(0, 10),
      remarks: params.passed
        ? `Self-study exam passed${params.percentage != null ? ` (${params.percentage}%)` : ""}. No certificate is issued for OJT.`
        : `Self-study exam not passed${params.percentage != null ? ` (${params.percentage}%)` : ""}. No certificate is issued for OJT.`,
      updatedAt: now,
      updatedBy: params.actorId,
    };
    await saveAssignment(next);
    await safeNotify(() =>
      notifyEmployee({
        employeeId: next.employeeId,
        type: "ojt",
        title: params.passed ? "OJT self study passed" : "OJT self study not passed",
        message: params.passed
          ? `${next.trainingTopic} is complete. A certificate is not issued for OJT.`
          : `${next.trainingTopic} was not passed. Ask your department if you should try again.`,
        link: `/dashboard/ojt/assignments/${next.id}`,
        actorId: params.actorId,
      })
    );
  }
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

  const matrixForm = await getOjtFormDocument("matrix", plan.year, plan.departmentId);
  assertFormUnlocked(matrixForm, "changing employee selection");

  if (
    params.employee.departmentId &&
    params.employee.departmentId !== plan.departmentId &&
    params.actor.role !== "super_admin" &&
    params.actor.role !== "qa"
  ) {
    throw new Error("Employee does not belong to the selected department");
  }

  const existingAsg = (await listOjtAssignments({
    employeeId: params.employee.id,
    topicId: plan.topicId,
    year: plan.year,
  })).find((a) => a.status !== "cancelled");
  if (
    existingAsg &&
    !["selected", "draft", "assigned"].includes(existingAsg.status) &&
    params.applicability !== "selected"
  ) {
    throw new Error("This OJT record is already in progress. Open the record instead of changing the matrix cell.");
  }

  const now = nowISO();
  const selections = plan.employeeSelections.filter((s) => s.employeeId !== params.employee.id);
  if (params.applicability !== "not_set") {
    selections.push({
      employeeId: params.employee.id,
      employeeCode: params.employee.employeeCode,
      employeeName: `${params.employee.firstName} ${params.employee.lastName}`.trim(),
      applicability: params.applicability,
      selectionDate: params.applicability === "selected" ? now : undefined,
    });
  }

  let assignment: OjtAssignment | null = null;
  if (params.applicability === "selected") {
    assignment = await createOjtAssignmentForEmployee({
      plan,
      employee: params.employee,
      actor: params.actor,
      trainerId: params.trainerId,
      trainerName: params.trainerName,
    });
  }

  const nextPlan = await upsertOjtPlan(
    { ...plan, employeeSelections: selections, year: plan.year, departmentId: plan.departmentId, topicId: plan.topicId },
    params.actor,
    { allowWhenLocked: true }
  );

  if (params.applicability !== "selected") {
    const open = existingAsg && ["selected", "draft", "assigned"].includes(existingAsg.status) ? existingAsg : null;
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
    deviation?: Omit<OjtExecutionDeviation, "revisedExecutionDate" | "originalPlannedMonth" | "originalYear">;
  },
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  if (!data.trainerId) throw new Error("Trainer is required before scheduling");
  const executionDate = calendarDateToIso(data.executionDate);
  const plannedMonths = plannedExecutionMonthsOf(assignment);
  const inPlannedMonth = plannedMonths.some((month) =>
    dateFallsInMonth(executionDate, assignment.year, month)
  );
  const settings = await getOjtSettings();
  let executionDeviation = assignment.executionDeviation;
  if (!inPlannedMonth) {
    const reason = data.deviation?.reason?.trim() || "";
    const authorizer = actor.role === "qa" || actor.role === "super_admin";
    if (!settings.requireExecutionDeviationApproval && actor.role === "super_admin") {
      executionDeviation = {
        reason: reason || "Authorized exception (settings allow dates outside planned month)",
        approvedBy: actor.uid,
        approvedByName: actor.name,
        approvalDate: nowISO(),
        originalPlannedMonth: assignment.plannedExecutionMonth,
        originalYear: assignment.year,
        revisedExecutionDate: executionDate,
      };
    } else if (authorizer && reason) {
      executionDeviation = {
        reason,
        approvedBy: actor.uid,
        approvedByName: actor.name,
        approvalDate: nowISO(),
        originalPlannedMonth: assignment.plannedExecutionMonth,
        originalYear: assignment.year,
        revisedExecutionDate: executionDate,
      };
    } else if (!authorizer) {
      throw new Error(
        "A QA officer or admin must authorize an execution date outside the planned month."
      );
    } else {
      throw new Error(
        `Execution date must fall in a planned execution month (${plannedMonths.join(", ")}/${assignment.year}) unless an authorized deviation is recorded.`
      );
    }
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
    executionDeviation,
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
    actualExecutionDate: data.actualExecutionDate
      ? calendarDateToIso(data.actualExecutionDate)
      : assignment.actualExecutionDate,
    startTime: data.startTime ?? assignment.startTime,
    endTime: data.endTime ?? assignment.endTime,
    location: data.location ?? assignment.location,
    practicalActivity: data.practicalActivity ?? assignment.practicalActivity,
    trainingDetails: data.trainingDetails ?? assignment.trainingDetails,
    observations: data.observations ?? assignment.observations,
    employeePerformance: data.employeePerformance ?? assignment.employeePerformance,
    trainerRemarks: data.trainerRemarks ?? assignment.trainerRemarks,
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
  const passed = !evaluationDidFail(evaluation.criteria) && evaluation.overallResult !== "fail";
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
  const holdForTrainerSignoff = assignment.requireTrainerSignoff !== false;
  const completedStatus = statusAfterTrainerCompletion(working, passed);
  const nextStatus = holdForTrainerSignoff ? working.status : completedStatus;
  if (!holdForTrainerSignoff) {
    assertTransition(working.status, nextStatus);
  }
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
    sopVersionId: assignment.trainedSopVersionId || assignment.sopVersionId,
    sopVersionNumber: assignment.trainedSopVersionNumber || assignment.sopVersionNumber,
  };
  const next: OjtAssignment = {
    ...working,
    evaluation: {
      ...evaluation,
      overallResult: passed ? "pass" : "fail",
      overallRating: evaluationOverallRating(evaluation.criteria),
      evaluatedBy: actor.uid,
      evaluatedByName: actor.name,
      evaluatedAt: nowISO(),
    },
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
  if (
    actor.role === "department_head" &&
    (!actor.departmentId || actor.departmentId !== assignment.departmentId)
  ) {
    throw new Error("Only the head of this department can verify this OJT");
  }
  if (assignment.status !== "verification_pending") {
    throw new Error("OJT is not pending HOD verification");
  }
  if (decision === "rejected" && !comments.trim()) {
    throw new Error("Comments are required when rejecting HOD verification");
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
    acknowledgement: decision === "rejected" ? undefined : assignment.acknowledgement,
    evaluation: decision === "rejected" ? undefined : assignment.evaluation,
    trainerSignoff: decision === "rejected" ? undefined : assignment.trainerSignoff,
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
  if (
    decision === "approved" &&
    actor.role !== "super_admin" &&
    assignment.hodVerification?.userId &&
    assignment.hodVerification.userId === actor.uid
  ) {
    throw new Error("The person who verified this OJT as HOD cannot also give QA approval");
  }
  if (decision === "rejected" && !comments.trim()) {
    throw new Error("Comments are required when rejecting QA approval");
  }
  const nextStatus = statusAfterQaDecision(assignment, decision);
  const rejected = decision === "rejected";
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
    overallCompetency: decision === "approved" ? "competent" : assignment.overallCompetency,
    failureReason: decision === "rejected" ? comments : assignment.failureReason,
    hodVerification: rejected ? undefined : assignment.hodVerification,
    acknowledgement:
      rejected && nextStatus !== "verification_pending" ? undefined : assignment.acknowledgement,
    evaluation: rejected && nextStatus === "in_progress" ? undefined : assignment.evaluation,
    trainerSignoff: rejected && nextStatus === "in_progress" ? undefined : assignment.trainerSignoff,
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
    sopVersionChangeJustification?: string;
  },
  actor: OjtActor
): Promise<OjtAssignment> {
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  const working: OjtAssignment = { ...assignment };
  if (working.status === "failed") {
    assertTransition(working.status, "retraining_required");
    working.status = "retraining_required";
  }
  assertTransition(working.status, "rescheduled");
  const retrainingDate = calendarDateToIso(data.retrainingDate);
  const dateParts = parseCalendarDateParts(retrainingDate);
  let sopVersionChangeJustification = working.sopVersionChangeJustification;
  let trainedSopVersionId = working.trainedSopVersionId;
  let trainedSopVersionNumber = working.trainedSopVersionNumber;
  if (working.sopId) {
    const snap = await resolveCurrentSopSnapshot(working.sopId);
    if (
      working.sopVersionId &&
      snap.sopVersionId !== working.sopVersionId &&
      !data.sopVersionChangeJustification
    ) {
      throw new Error(
        `Current SOP version is ${snap.sopVersionNumber} (planned ${working.sopVersionNumber}). Record a controlled justification before retraining against the new version.`
      );
    }
    if (data.sopVersionChangeJustification) {
      sopVersionChangeJustification = data.sopVersionChangeJustification;
    }
    trainedSopVersionId = snap.sopVersionId;
    trainedSopVersionNumber = snap.sopVersionNumber;
  }
  const next: OjtAssignment = {
    ...working,
    status: "rescheduled",
    isRetraining: true,
    attemptNumber: (working.attemptNumber || 1) + 1,
    retrainingDate,
    actualExecutionDate: retrainingDate,
    plannedExecutionMonth: dateParts?.month || working.plannedExecutionMonth,
    plannedExecutionMonths: dateParts?.month
      ? [dateParts.month]
      : working.plannedExecutionMonths,
    year: dateParts?.year || working.year,
    trainerId: data.trainerId || working.trainerId,
    trainerName: data.trainerName || working.trainerName,
    remarks: data.remarks || working.remarks,
    sopVersionChangeJustification,
    trainedSopVersionId,
    trainedSopVersionNumber,
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

/** Super Admin only — edit assignment metadata outside the workflow. */
export async function updateOjtAssignmentAdmin(
  id: string,
  patch: {
    trainingTopic?: string;
    plannedExecutionMonth?: number;
    selectionMonth?: number;
    trainerId?: string;
    trainerName?: string;
    remarks?: string;
    location?: string;
  },
  actor: OjtActor
): Promise<OjtAssignment> {
  assertOjtSuperAdmin(actor);
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");
  const next: OjtAssignment = {
    ...assignment,
    ...patch,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  if (Object.prototype.hasOwnProperty.call(patch, "trainerId") && !patch.trainerId) {
    delete next.trainerId;
    delete next.trainerName;
  }
  await saveAssignment(next);
  await audit({
    action: "update",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Super Admin edited OJT for ${assignment.employeeName}`,
    before: {
      trainingTopic: assignment.trainingTopic,
      trainerId: assignment.trainerId,
      plannedExecutionMonth: assignment.plannedExecutionMonth,
    },
    after: {
      trainingTopic: next.trainingTopic,
      trainerId: next.trainerId,
      plannedExecutionMonth: next.plannedExecutionMonth,
    },
  });
  return next;
}

/** Super Admin only — permanently remove an OJT record. */
export async function deleteOjtAssignment(id: string, actor: OjtActor): Promise<void> {
  assertOjtSuperAdmin(actor);
  const assignment = await getOjtAssignment(id);
  if (!assignment) throw new Error("OJT assignment not found");

  if (preferOjtLocal()) {
    const store = readOjtStore();
    store.assignments = store.assignments.filter((a) => a.id !== id);
    if (assignment.planId) {
      const plan = store.plans.find((p) => p.id === assignment.planId);
      if (plan) {
        plan.employeeSelections = plan.employeeSelections.filter(
          (s) => s.employeeId !== assignment.employeeId
        );
      }
    }
    writeOjtStore(store);
  } else {
    await ojtDeleteDoc(doc(db, COLLECTIONS.ojtAssignments, id));
    if (assignment.planId) {
      const plan = await getOjtPlan(assignment.planId);
      if (plan) {
        await savePlan({
          ...plan,
          employeeSelections: plan.employeeSelections.filter(
            (s) => s.employeeId !== assignment.employeeId
          ),
          updatedAt: nowISO(),
          updatedBy: actor.uid,
        });
      } else {
        notifyOjtUpdated();
      }
    } else {
      notifyOjtUpdated();
    }
  }

  await audit({
    action: "delete",
    resourceType: "ojt_assignment",
    resourceId: id,
    description: `Deleted OJT record ${assignment.trainingTopic} for ${assignment.employeeName}`,
    before: {
      employeeId: assignment.employeeId,
      trainingTopic: assignment.trainingTopic,
      status: assignment.status,
    },
  });
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
  assertAllowedUpload(params.file, {
    maxBytes: 25 * 1024 * 1024,
    label: "OJT evidence",
    accept: isTrainingEvidence,
  });
  const assignment = await getOjtAssignment(params.assignmentId);
  if (!assignment) throw new Error("OJT assignment not found");
  const attId = generateId("ojt_attf");
  const safeName = sanitizeStorageFileName(params.file.name);
  const storagePath = `ojt/${assignment.id}/${attId}_${safeName}`;
  let downloadUrl = "";
  if (isDemoMode() || preferOjtLocal()) {
    downloadUrl = URL.createObjectURL(params.file);
  } else {
    await uploadBytes(ref(storage, storagePath), params.file, { contentType: params.file.type });
    downloadUrl = await getDownloadURL(ref(storage, storagePath));
  }
  const attachment: OjtAttachment = {
    id: attId,
    fileName: safeName,
    storagePath,
    downloadUrl,
    fileType: params.file.type || "application/octet-stream",
    fileSize: params.file.size,
    uploadedBy: params.actor.uid,
    uploadedByName: params.actor.name,
    uploadedAt: nowISO(),
    kind: params.kind,
  };
  const next = await appendAssignmentAttachment(assignment, attachment, params.actor.uid);
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
  const fresh = await getOjtAssignment(assignmentId);
  if (!fresh) throw new Error("OJT assignment not found");
  const attachments = fresh.attachments || [];
  const att = attachments.find((a) => a.id === attachmentId);
  if (!att) throw new Error("Attachment not found");
  if (!preferOjtLocal() && !isDemoMode() && att.storagePath && !att.storagePath.startsWith("demo/")) {
    try {
      await deleteObject(ref(storage, att.storagePath));
    } catch {
      /* ignore missing storage object */
    }
  }
  const now = nowISO();
  const remaining = (fresh.attachments || []).filter((a) => a.id !== attachmentId);
  let next: OjtAssignment;
  if (preferOjtLocal()) {
    const store = readOjtStore();
    const idx = store.assignments.findIndex((a) => a.id === assignmentId);
    if (idx < 0) throw new Error("OJT assignment not found");
    const current = store.assignments[idx];
    next = {
      ...current,
      attachments: (current.attachments || []).filter((a) => a.id !== attachmentId),
      updatedAt: now,
      updatedBy: actor.uid,
    };
    store.assignments[idx] = next;
    writeOjtStore(store);
  } else {
    try {
      await updateDoc(doc(db, COLLECTIONS.ojtAssignments, assignmentId), {
        attachments: remaining,
        updatedAt: now,
        updatedBy: actor.uid,
      });
    } catch (err) {
      return rethrowOjtPermission(err, COLLECTIONS.ojtAssignments);
    }
    notifyOjtUpdated();
    next = { ...fresh, attachments: remaining, updatedAt: now, updatedBy: actor.uid };
  }
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
  const users = await listUsersByRoles(["trainer", "department_head", "qa", "hr", "super_admin"]).catch(() => []);
  return users.map((u) => ({
    uid: u.uid,
    displayName: u.displayName,
    role: u.role,
  }));
}

export async function getOjtFormDocument(
  kind: OjtFormKind,
  year: number,
  departmentId: string
): Promise<OjtFormDocument | null> {
  const id = formDocumentId(kind, year, departmentId);
  if (preferOjtLocal()) {
    const row = readOjtStore().formDocuments.find((d) => d.id === id);
    return row ? cloneRow(row) : null;
  }
  try {
    return await cachedRead(`ojt_forms/${id}`, async () => {
      assertFirestoreReadsOpen();
      const snap = await getDoc(doc(db, COLLECTIONS.ojtFormDocuments, id));
      return snap.exists() ? ({ id: snap.id, ...firestoreFields(snap) } as OjtFormDocument) : null;
    });
  } catch (err) {
    if (isResourceExhausted(err)) return rethrowOjtPermission(err);
    if (!isPermissionDenied(err)) throw err;
    const row = readOjtStore().formDocuments.find((d) => d.id === id);
    return row ? cloneRow(row) : null;
  }
}

export async function listOjtFormDocuments(filters?: {
  year?: number;
  kind?: OjtFormKind;
  departmentId?: string;
}): Promise<OjtFormDocument[]> {
  const apply = (rows: OjtFormDocument[]) =>
    rows.filter((d) => {
      if (filters?.year && d.year !== filters.year) return false;
      if (filters?.kind && d.kind !== filters.kind) return false;
      if (filters?.departmentId && d.departmentId !== filters.departmentId) return false;
      return true;
    });

  if (preferOjtLocal()) {
    return apply(readOjtStore().formDocuments);
  }
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.ojtFormDocuments));
    return apply(snap.docs.map((d) => ({ id: d.id, ...firestoreFields(d) } as OjtFormDocument)));
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
    return apply(readOjtStore().formDocuments);
  }
}

export async function ensureOjtFormDocument(params: {
  kind: OjtFormKind;
  year: number;
  departmentId: string;
  departmentName?: string;
  actor: OjtActor;
}): Promise<OjtFormDocument> {
  const existing = await getOjtFormDocument(params.kind, params.year, params.departmentId);
  if (existing) return existing;
  const settings = await getOjtSettings();
  const created = emptyFormDocument({
    kind: params.kind,
    year: params.year,
    departmentId: params.departmentId,
    departmentName: params.departmentName,
    settings,
    actorId: params.actor.uid,
  });
  await saveFormDocument(created);
  await audit({
    action: "create",
    resourceType: `ojt_${params.kind}`,
    resourceId: created.id,
    description: `Created ${params.kind} document ${params.departmentName || params.departmentId} ${params.year} Rev. ${created.revisionNumber}`,
  });
  return created;
}

export async function updateOjtFormDocumentMeta(
  kind: OjtFormKind,
  year: number,
  departmentId: string,
  patch: {
    effectiveDate?: string;
    trainingCoordinatorUserId?: string;
    trainingCoordinatorName?: string;
    departmentName?: string;
  },
  actor: OjtActor
): Promise<OjtFormDocument> {
  const row = await ensureOjtFormDocument({ kind, year, departmentId, actor, departmentName: patch.departmentName });
  assertFormUnlocked(row, "updating header metadata");
  const next: OjtFormDocument = {
    ...row,
    ...patch,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };
  await saveFormDocument(next);
  await audit({
    action: "update",
    resourceType: `ojt_${kind}`,
    resourceId: next.id,
    description: `Updated ${kind} header ${departmentId} ${year}`,
    before: { effectiveDate: row.effectiveDate, revisionNumber: row.revisionNumber },
    after: { effectiveDate: next.effectiveDate, revisionNumber: next.revisionNumber },
  });
  return next;
}

function formSignoffLink(doc: OjtFormDocument): string {
  const base = doc.kind === "planner" ? "/dashboard/ojt/planner" : "/dashboard/ojt/matrix";
  const params = new URLSearchParams({
    departmentId: doc.departmentId,
    year: String(doc.year),
  });
  return `${base}?${params.toString()}`;
}

async function notifyFormAssigneeIfReady(
  doc: OjtFormDocument,
  role: OjtFormSignoffRole,
  actorId: string
): Promise<void> {
  const person = formAssignee(doc, role);
  if (!person?.userId || person.userId === actorId) return;
  if (hasAcceptedSignoff(doc, role)) return;
  const settings = await getOjtSettings();
  const config = formApprovalsFor(doc.kind, settings);
  if (!canSignFormRole(doc, config, role)) return;
  const labels = OJT_FORM_SIGNOFF_LABELS[role];
  const formName = doc.kind === "planner" ? "On Job Training Planner" : "Employee Training Matrix";
  await safeNotify(() =>
    createNotification({
      userId: person.userId,
      type: "ojt",
      title: `${labels.title} — electronic signature needed`,
      message: `${doc.departmentName || "Department"} ${doc.year} ${formName}. You are ${labels.subtitle}. Open this and add your electronic signature.`,
      link: formSignoffLink(doc),
      actorId,
      id: `ojt-form-${doc.id}-${doc.revisionNumber}-${role}-${person.userId}`,
      metadata: {
        kind: "ojt_form_signoff",
        ojtKind: doc.kind,
        year: String(doc.year),
        departmentId: doc.departmentId,
        departmentName: doc.departmentName || "",
        role,
      },
    })
  );
}

export async function assignOjtFormApprover(params: {
  kind: OjtFormKind;
  year: number;
  departmentId: string;
  departmentName?: string;
  role: OjtFormSignoffRole;
  userId: string;
  userName: string;
  actor: OjtActor;
}): Promise<OjtFormDocument> {
  const userId = params.userId.trim();
  const userName = params.userName.trim();
  if (!userId || !userName) throw new Error("Select who will approve this step");
  const row = await ensureOjtFormDocument({
    kind: params.kind,
    year: params.year,
    departmentId: params.departmentId,
    departmentName: params.departmentName,
    actor: params.actor,
  });
  assertFormUnlocked(row, "choosing an approver");
  if (hasAcceptedSignoff(row, params.role)) {
    throw new Error("This step already has an electronic signature");
  }
  const assignees = [
    ...(row.assignees || []).filter((item) => item.role !== params.role),
    { role: params.role, userId, userName },
  ];
  const next: OjtFormDocument = {
    ...row,
    assignees,
    departmentName: params.departmentName || row.departmentName,
    updatedAt: nowISO(),
    updatedBy: params.actor.uid,
  };
  await saveFormDocument(next);
  await notifyFormAssigneeIfReady(next, params.role, params.actor.uid);
  const labels = OJT_FORM_SIGNOFF_LABELS[params.role];
  await audit({
    action: "update",
    resourceType: `ojt_${params.kind}`,
    resourceId: next.id,
    description: `Assigned ${userName} to ${labels.title} on ${params.kind} ${params.departmentId} ${params.year}`,
    after: { role: params.role, userId, userName },
  });
  return next;
}

export async function signOjtFormDocument(params: {
  kind: OjtFormKind;
  year: number;
  departmentId: string;
  departmentName?: string;
  role: OjtFormSignoffRole;
  action: "prepared" | "checked" | "verified" | "approved" | "rejected";
  comment?: string;
  actor: OjtActor;
}): Promise<OjtFormDocument> {
  const settings = await getOjtSettings();
  const row = await ensureOjtFormDocument({
    kind: params.kind,
    year: params.year,
    departmentId: params.departmentId,
    departmentName: params.departmentName,
    actor: params.actor,
  });
  if (row.locked && params.action !== "rejected") {
    throw new Error("This controlled form is already approved. Create a revision to change it.");
  }
  const assignee = formAssignee(row, params.role);
  if (!assignee) throw new Error("Select who will approve this step before signing");
  if (params.actor.role !== "super_admin" && assignee.userId !== params.actor.uid) {
    throw new Error(`This step is assigned to ${assignee.userName}`);
  }
  if (params.action !== "rejected" && hasAcceptedSignoff(row, params.role)) {
    throw new Error("This step already has an electronic signature");
  }
  const config = formApprovalsFor(params.kind, settings);
  if (params.action !== "rejected" && !canSignFormRole(row, config, params.role)) {
    throw new Error("Earlier sign-offs on this form are still pending");
  }
  if (params.action === "approved" && params.role === "approved_by_qa" && !canApproveForm(row, config)) {
    throw new Error("Required preparation/checking/verification sign-offs are incomplete");
  }
  if (params.action === "rejected" && !params.comment?.trim()) {
    throw new Error("A comment is required when rejecting a controlled form");
  }
  const rejected = params.action === "rejected";
  const nextStatus = statusAfterFormSignoff(row.status, params.role, rejected);
  const next: OjtFormDocument = {
    ...row,
    status: nextStatus,
    locked: nextStatus === "approved",
    signoffs: [
      ...row.signoffs,
      {
        role: params.role,
        action: params.action,
        userId: params.actor.uid,
        userName: params.actor.name,
        userRole: params.actor.role,
        timestamp: nowISO(),
        comment: params.comment,
        signatureDataUrl: params.actor.digitalSignatureUrl,
      },
    ],
    updatedAt: nowISO(),
    updatedBy: params.actor.uid,
  };
  await saveFormDocument(next);
  if (!rejected) {
    const required = requiredRolesForApproval(config);
    const nextRole = required[required.indexOf(params.role) + 1];
    if (nextRole) await notifyFormAssigneeIfReady(next, nextRole, params.actor.uid);
  }
  await audit({
    action: rejected ? "reject" : "approve",
    resourceType: `ojt_${params.kind}`,
    resourceId: next.id,
    description: `${params.role} ${params.action} ${params.kind} ${params.departmentId} ${params.year}`,
    after: { status: next.status, locked: next.locked },
  });
  return next;
}

export async function createOjtFormRevision(params: {
  kind: OjtFormKind;
  year: number;
  departmentId: string;
  reason: string;
  actor: OjtActor;
  snapshot?: Record<string, unknown>;
}): Promise<OjtFormDocument> {
  if (!params.reason.trim()) throw new Error("A reason is required to create a revision");
  const row = await getOjtFormDocument(params.kind, params.year, params.departmentId);
  if (!row) throw new Error("No approved form exists to revise");
  const nextRev = nextRevisionNumber(row.revisionNumber);
  const next: OjtFormDocument = {
    ...row,
    revisionNumber: nextRev,
    effectiveDate: nowISO().slice(0, 10),
    status: "draft",
    locked: false,
    signoffs: [],
    revisions: [
      ...row.revisions,
      {
        revisionNumber: formatRevisionNumber(row.revisionNumber),
        effectiveDate: row.effectiveDate,
        createdAt: nowISO(),
        createdBy: params.actor.uid,
        createdByName: params.actor.name,
        reason: params.reason.trim(),
        snapshot: params.snapshot || {
          status: row.status,
          signoffs: row.signoffs,
          effectiveDate: row.effectiveDate,
        },
      },
    ],
    updatedAt: nowISO(),
    updatedBy: params.actor.uid,
  };
  await saveFormDocument(next);
  const firstRole = requiredRolesForApproval(formApprovalsFor(params.kind, await getOjtSettings()))[0];
  if (firstRole) await notifyFormAssigneeIfReady(next, firstRole, params.actor.uid);
  await audit({
    action: "create",
    resourceType: `ojt_${params.kind}`,
    resourceId: next.id,
    description: `Created ${params.kind} revision ${nextRev} for ${params.departmentId} ${params.year}`,
    before: { revisionNumber: row.revisionNumber, locked: row.locked },
    after: { revisionNumber: next.revisionNumber, reason: params.reason },
  });
  return next;
}

export { currentCalendarYear, currentCalendarMonth };
