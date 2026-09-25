/**
 * Training service — SOP assignment, sessions, JD/TNI, notifications.
 * Uses Firestore when available; falls back to local demo store.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  deleteField,
} from "firebase/firestore/lite";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import type {
  TrainingAssignment,
  TrainingSession,
  TrainingAttendance,
  JobDescription,
  TrainingNeedIdentification,
  TrainerProfile,
  JdSignoff,
  JdSignoffSlot,
  TniSignoffSlot,
} from "@/types";
import { generateId, nowISO } from "@/lib/services/helpers";
import {
  preferTrainingLocal,
  readTrainingStore,
  writeTrainingStore,
  notifyTrainingUpdated,
} from "@/lib/training/demo-store";
import {
  readLifecycleStore,
  upsertDemoEmployee,
} from "@/lib/lifecycle/demo-store";
import { isDemoMode } from "@/lib/demo/data";
import {
  createNotification,
  notifyEmployee,
  resolveLinkedUserUid,
} from "@/lib/services/notifications";
import {
  buildJdComputerGeneratedSignature,
  compactJdSignoff,
  extraEmployeeIdsFromEmployees,
  getJdSignoff,
  isJdSignoffParty,
  isJdSignoffPending,
  JD_SIGNOFF_SLOTS,
  parseJdSignoffSlot,
  sameJdSignoffPerson,
} from "@/lib/jd/absence-handover";
import {
  getTniSignoff,
  isTniSignoffPending,
  parseTniSignoffSlot,
  TNI_SIGNOFF_SLOTS,
} from "@/lib/tni/signoff";

// Re-export for existing callers
export {
  createNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getUnreadNotificationCount,
  NOTIFICATIONS_UPDATED_EVENT,
} from "@/lib/services/notifications";

/** Firestore rejects `undefined` field values — strip them before writes. */
function sanitizeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
export async function assignSopTraining(params: {
  employeeIds: string[];
  sopId: string;
  sopVersionId: string;
  trainerId: string;
  departmentId: string;
  dueDate?: string;
  actorId: string;
  sessionTitle?: string;
  scheduledAt?: string;
}): Promise<{
  assignments: TrainingAssignment[];
  session: TrainingSession;
  skipped: string[];
}> {
  const now = nowISO();
  const assignments: TrainingAssignment[] = [];
  const skipped: string[] = [];
  const local = preferTrainingLocal();

  const assignableEmployeeIds: string[] = [];
  for (const employeeId of params.employeeIds) {
    if (local) {
      const store = readTrainingStore();
      const exists = store.assignments.some(
        (a) =>
          a.employeeId === employeeId &&
          a.sopId === params.sopId &&
          a.status !== "passed" &&
          a.status !== "failed"
      );
      if (exists) {
        skipped.push(employeeId);
        continue;
      }
    } else {
      const dupQ = query(
        collection(db, COLLECTIONS.trainingAssignments),
        where("employeeId", "==", employeeId),
        where("sopId", "==", params.sopId)
      );
      const dupSnap = await getDocs(dupQ);
      const open = dupSnap.docs.some((d) => {
        const status = d.data().status as TrainingAssignment["status"];
        return status !== "passed" && status !== "failed";
      });
      if (open) {
        skipped.push(employeeId);
        continue;
      }
    }
    assignableEmployeeIds.push(employeeId);
  }

  if (assignableEmployeeIds.length === 0) {
    throw new Error(
      skipped.length
        ? "All selected employees already have open training for this SOP"
        : "No employees selected for training"
    );
  }

  const session = await createTrainingSession(
    {
      title: params.sessionTitle || "SOP Training Session",
      description: "Assigned SOP training",
      sopId: params.sopId,
      sopVersionId: params.sopVersionId,
      trainerId: params.trainerId,
      departmentId: params.departmentId,
      scheduledAt: params.scheduledAt || now,
      durationMinutes: 60,
      mode: "classroom",
      materials: [],
    },
    params.actorId
  );

  for (const employeeId of assignableEmployeeIds) {
    const id = generateId("ta");
    const assignment: TrainingAssignment = {
      id,
      employeeId,
      sopId: params.sopId,
      sopVersionId: params.sopVersionId,
      trainerId: params.trainerId,
      assignedBy: params.actorId,
      departmentId: params.departmentId,
      sessionId: session.id,
      status: "assigned",
      dueDate: params.dueDate,
      attemptCount: 0,
      isRetraining: false,
      triggeredBySopRevision: false,
      createdAt: now,
      updatedAt: now,
      createdBy: params.actorId,
    };
    assignments.push(assignment);

    if (local) {
      const store = readTrainingStore();
      store.assignments.push(assignment);
      writeTrainingStore(store);
    } else {
      await setDoc(
        doc(db, COLLECTIONS.trainingAssignments, id),
        sanitizeForFirestore(assignment)
      );
    }

    await notifyEmployee({
      employeeId,
      type: "assignment",
      title: "New SOP Training Assigned",
      message: "You have been assigned a new SOP training. Please review the materials.",
      link: `/dashboard/training/sessions/${session.id}`,
      actorId: params.actorId,
    });
  }

  if (params.trainerId && assignments.length > 0) {
    await createNotification({
      userId: params.trainerId,
      type: "assignment",
      title: "Training Session Assigned",
      message: "You have been assigned to conduct an SOP training session.",
      link: `/dashboard/training/sessions/${session.id}`,
      actorId: params.actorId,
    });
  }

  // Seed attendance roster on the session
  const roster: TrainingAttendance[] = assignments.map((a) => ({
    employeeId: a.employeeId,
    present: false,
  }));
  if (local) {
    const store = readTrainingStore();
    store.sessions = store.sessions.map((s) =>
      s.id === session.id ? { ...s, attendance: roster, updatedAt: now } : s
    );
    writeTrainingStore(store);
  } else {
    await updateDoc(doc(db, COLLECTIONS.trainingSessions, session.id), {
      attendance: roster,
      updatedAt: now,
    });
  }

  const { recordAuditEvent } = await import("@/lib/services/audit-logs");
  await recordAuditEvent({
    action: "assign",
    resourceType: "training_session",
    resourceId: session.id,
    description: `Assigned SOP training to ${assignments.length} employee(s)${
      skipped.length ? ` · ${skipped.length} skipped` : ""
    }`,
    after: {
      sopId: params.sopId,
      trainerId: params.trainerId,
      departmentId: params.departmentId,
      employeeCount: assignments.length,
      skipped,
    },
  });

  return { assignments, session: { ...session, attendance: roster }, skipped };
}

export async function createTrainingSession(
  data: Omit<
    TrainingSession,
    "id" | "createdAt" | "updatedAt" | "createdBy" | "attendance" | "status"
  >,
  actorId: string
): Promise<TrainingSession> {
  const id = generateId("ts");
  const now = nowISO();
  const session: TrainingSession = {
    ...data,
    id,
    status: "scheduled",
    attendance: [],
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.sessions.push(session);
    writeTrainingStore(store);
    return session;
  }

  await setDoc(doc(db, COLLECTIONS.trainingSessions, id), sanitizeForFirestore(session));
  return session;
}

export async function getTrainingSession(id: string): Promise<TrainingSession | null> {
  if (preferTrainingLocal()) {
    return readTrainingStore().sessions.find((s) => s.id === id) || null;
  }
  const snap = await getDoc(doc(db, COLLECTIONS.trainingSessions, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TrainingSession;
}

export async function listTrainingSessions(): Promise<TrainingSession[]> {
  if (preferTrainingLocal()) {
    return [...readTrainingStore().sessions].sort((a, b) =>
      b.scheduledAt.localeCompare(a.scheduledAt)
    );
  }
  const snap = await getDocs(collection(db, COLLECTIONS.trainingSessions));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TrainingSession)
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

export type TrainingAssignmentFilters = {
  employeeId?: string;
  departmentId?: string;
  trainerUserId?: string;
};

export async function listTrainingAssignments(
  filters?: TrainingAssignmentFilters
): Promise<TrainingAssignment[]> {
  if (preferTrainingLocal()) {
    let rows = [...readTrainingStore().assignments];
    if (filters?.employeeId) {
      rows = rows.filter((a) => a.employeeId === filters.employeeId);
    }
    if (filters?.departmentId) {
      rows = rows.filter((a) => a.departmentId === filters.departmentId);
    }
    if (filters?.trainerUserId) {
      rows = rows.filter((a) => a.trainerId === filters.trainerUserId);
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (filters?.employeeId) {
    return getEmployeeAssignments(filters.employeeId);
  }

  const constraints = [];
  if (filters?.departmentId) {
    constraints.push(where("departmentId", "==", filters.departmentId));
  }
  if (filters?.trainerUserId) {
    constraints.push(where("trainerId", "==", filters.trainerUserId));
  }

  const q =
    constraints.length > 0
      ? query(collection(db, COLLECTIONS.trainingAssignments), ...constraints)
      : collection(db, COLLECTIONS.trainingAssignments);
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSessionAssignments(
  sessionId: string,
  opts?: { employeeId?: string }
): Promise<TrainingAssignment[]> {
  if (preferTrainingLocal()) {
    return readTrainingStore().assignments.filter(
      (a) =>
        a.sessionId === sessionId &&
        (!opts?.employeeId || a.employeeId === opts.employeeId)
    );
  }

  // Employees may only read their own assignment docs — sessionId-only queries fail rules.
  if (opts?.employeeId) {
    const mine = await getEmployeeAssignments(opts.employeeId);
    return mine.filter((a) => a.sessionId === sessionId);
  }

  const q = query(
    collection(db, COLLECTIONS.trainingAssignments),
    where("sessionId", "==", sessionId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment);
}

export async function markAttendance(
  sessionId: string,
  attendance: TrainingAttendance[],
  actorId: string
): Promise<void> {
  const now = nowISO();
  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.sessions = store.sessions.map((s) =>
      s.id === sessionId
        ? { ...s, attendance, status: "in_progress", updatedAt: now, updatedBy: actorId }
        : s
    );
    writeTrainingStore(store);
    return;
  }

  await updateDoc(doc(db, COLLECTIONS.trainingSessions, sessionId), {
    attendance,
    status: "in_progress",
    updatedAt: now,
    updatedBy: actorId,
  });
}

export async function completeTrainingSession(
  sessionId: string,
  notes: string,
  actorId: string
): Promise<void> {
  const now = nowISO();
  const local = preferTrainingLocal();

  let session: TrainingSession | null = null;
  if (local) {
    const store = readTrainingStore();
    store.sessions = store.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      session = {
        ...s,
        status: "completed",
        completedAt: now,
        notes,
        updatedAt: now,
        updatedBy: actorId,
      };
      return session;
    });
    writeTrainingStore(store);
  } else {
    await updateDoc(doc(db, COLLECTIONS.trainingSessions, sessionId), {
      status: "completed",
      completedAt: now,
      notes,
      updatedAt: now,
      updatedBy: actorId,
    });
    const sessionSnap = await getDoc(doc(db, COLLECTIONS.trainingSessions, sessionId));
    if (sessionSnap.exists()) {
      session = { id: sessionSnap.id, ...sessionSnap.data() } as TrainingSession;
    }
  }

  if (!session) return;

  const updateAssignmentStatus = async (
    employeeId: string,
    patch: Partial<TrainingAssignment>
  ) => {
    if (local) {
      const store = readTrainingStore();
      store.assignments = store.assignments.map((a) =>
        a.employeeId === employeeId && a.sessionId === sessionId
          ? { ...a, ...patch, updatedAt: now, updatedBy: actorId }
          : a
      );
      writeTrainingStore(store);
    } else {
      const q = query(
        collection(db, COLLECTIONS.trainingAssignments),
        where("employeeId", "==", employeeId),
        where("sessionId", "==", sessionId)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(d.ref, { ...patch, updatedAt: now, updatedBy: actorId });
      }
    }
  };

  for (const att of session.attendance.filter((a) => a.present)) {
    await updateAssignmentStatus(att.employeeId, {
      status: "assessment_pending",
      trainingCompletedAt: now,
    });

    await notifyEmployee({
      employeeId: att.employeeId,
      type: "assessment",
      title: "Assessment Ready",
      message: "Your training session is complete. Please take the assessment.",
      link: `/dashboard/exams`,
      actorId,
    });
  }

  for (const att of session.attendance.filter((a) => !a.present)) {
    await updateAssignmentStatus(att.employeeId, {
      status: "failed",
    });

    await notifyEmployee({
      employeeId: att.employeeId,
      type: "assignment",
      title: "Training Session Missed",
      message: "You were marked absent. Contact your trainer to reschedule.",
      link: `/dashboard/training`,
      actorId,
    });
  }

  if (session.trainerId) {
    await incrementTrainerSessionsConducted(session.trainerId, actorId);
  }
}

async function incrementTrainerSessionsConducted(
  trainerRef: string,
  actorId: string
): Promise<void> {
  const profile = await getTrainerProfile(trainerRef);
  if (!profile) return;
  const now = nowISO();
  const next = (profile.totalSessionsConducted || 0) + 1;
  const local = preferTrainingLocal();

  if (local) {
    const store = readTrainingStore();
    store.trainers = store.trainers.map((t) =>
      t.id === profile.id
        ? { ...t, totalSessionsConducted: next, updatedAt: now, updatedBy: actorId }
        : t
    );
    writeTrainingStore(store);
  } else {
    await updateDoc(doc(db, COLLECTIONS.trainers, profile.id), {
      totalSessionsConducted: next,
      updatedAt: now,
      updatedBy: actorId,
    });
  }
  notifyTrainingUpdated();
}

export async function getEmployeeAssignments(
  employeeId: string
): Promise<TrainingAssignment[]> {
  if (preferTrainingLocal()) {
    return readTrainingStore()
      .assignments.filter((a) => a.employeeId === employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  try {
    const q = query(
      collection(db, COLLECTIONS.trainingAssignments),
      where("employeeId", "==", employeeId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment);
  } catch {
    // Fallback without orderBy if composite index is missing
    const q = query(
      collection(db, COLLECTIONS.trainingAssignments),
      where("employeeId", "==", employeeId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

function normalizeJdNo(value: string): string {
  return value.trim().toUpperCase();
}

async function assertUniqueJdNo(jdNo: string, excludeId?: string): Promise<void> {
  const normalized = normalizeJdNo(jdNo);
  if (!normalized) throw new Error("JD number required");

  if (preferTrainingLocal()) {
    const dup = readTrainingStore().jobDescriptions.some(
      (j) => j.id !== excludeId && normalizeJdNo(j.jdNo || "") === normalized
    );
    if (dup) throw new Error(`JD number "${normalized}" already exists`);
    return;
  }

  const dupSnap = await getDocs(
    query(collection(db, COLLECTIONS.jobDescriptions), where("jdNo", "==", normalized), limit(1))
  );
  if (dupSnap.docs.some((d) => d.id !== excludeId)) {
    throw new Error(`JD number "${normalized}" already exists`);
  }
}

async function notifyJdSignoff(
  jd: JobDescription,
  slot: JdSignoffSlot,
  actorId: string
): Promise<void> {
  const signoff = getJdSignoff(jd, slot);
  if (!signoff || (!signoff.employeeId && !signoff.userId)) return;
  const meta = JD_SIGNOFF_SLOTS[slot];
  const label = jd.jdNo || jd.id;
  const title = `${meta.label} – ${meta.actionLabel.toLowerCase()} required`;
  const message = `You were named on Job Description ${label}${jd.title ? ` (${jd.title})` : ""} for "${meta.label}". Please tap ${meta.actionLabel}.`;
  const link = `/dashboard/jd?acknowledge=${encodeURIComponent(jd.id)}&slot=${slot}`;
  const metadata = { jdId: jd.id, kind: meta.kind, slot };

  try {
    const uid =
      signoff.userId ||
      (signoff.employeeId ? await resolveLinkedUserUid(signoff.employeeId) : null);
    if (uid) {
      await createNotification({
        userId: uid,
        type: "handover",
        title,
        message,
        link,
        actorId,
        metadata,
      });
      return;
    }
    if (signoff.employeeId) {
      await notifyEmployee({
        employeeId: signoff.employeeId,
        type: "handover",
        title,
        message,
        link,
        actorId,
        metadata,
      });
    }
  } catch (err) {
    console.warn(`[jd] ${slot} notification failed`, err);
  }
}

async function notifyAllJdSignoffs(jd: JobDescription, actorId: string): Promise<void> {
  await notifyJdSignoff(jd, "absence_handover", actorId);
  await notifyJdSignoff(jd, "assigned_by", actorId);
  await notifyJdSignoff(jd, "accepted_by", actorId);
}

async function hydrateSignoffUserId(signoff?: JdSignoff): Promise<JdSignoff | undefined> {
  if (!signoff) return undefined;
  if (signoff.userId || !signoff.employeeId) {
    return compactJdSignoff({ ...signoff, status: signoff.status || "pending" });
  }
  const uid = await resolveLinkedUserUid(signoff.employeeId);
  return compactJdSignoff({
    ...signoff,
    status: signoff.status || "pending",
    ...(uid ? { userId: uid } : {}),
  });
}

function signoffPersonChanged(prev?: JdSignoff, next?: JdSignoff): boolean {
  if (!next) return false;
  if (!prev) return true;
  return !sameJdSignoffPerson(prev, next);
}

function mergeResolvedSignoffLogin(existing: JdSignoff, next: JdSignoff): JdSignoff | null {
  if (existing.status === "acknowledged") return null;
  if (existing.userId || !next.userId) return null;
  return compactJdSignoff({ ...existing, userId: next.userId });
}

async function notifyJdAbsenceHandover(jd: JobDescription, actorId: string): Promise<void> {
  await notifyJdSignoff(jd, "absence_handover", actorId);
}

async function notifyTniSignoff(
  tni: TrainingNeedIdentification,
  slot: TniSignoffSlot,
  actorId: string
): Promise<void> {
  const signoff = getTniSignoff(tni, slot);
  if (!signoff || (!signoff.employeeId && !signoff.userId)) return;
  const meta = TNI_SIGNOFF_SLOTS[slot];
  const title = `${meta.label} – ${meta.actionLabel.toLowerCase()} required`;
  const message = `You were named on TNI ${tni.id} for "${meta.label}" (${meta.roleLine}). Please tap ${meta.actionLabel}.`;
  const link = `/dashboard/tni?acknowledge=${encodeURIComponent(tni.id)}&slot=${slot}`;
  const metadata = { tniId: tni.id, kind: meta.kind, slot };

  try {
    const uid =
      signoff.userId ||
      (signoff.employeeId ? await resolveLinkedUserUid(signoff.employeeId) : null);
    if (uid) {
      await createNotification({
        userId: uid,
        type: "handover",
        title,
        message,
        link,
        actorId,
        metadata,
      });
      return;
    }
    if (signoff.employeeId) {
      await notifyEmployee({
        employeeId: signoff.employeeId,
        type: "handover",
        title,
        message,
        link,
        actorId,
        metadata,
      });
    }
  } catch (err) {
    console.warn(`[tni] ${slot} notification failed`, err);
  }
}

async function notifyAllTniSignoffs(tni: TrainingNeedIdentification, actorId: string): Promise<void> {
  await notifyTniSignoff(tni, "prepared_by", actorId);
  await notifyTniSignoff(tni, "approved_by", actorId);
}

function nextPendingSignoff(
  existing: JdSignoff | undefined,
  next: JdSignoff | undefined
): { value?: JdSignoff; changed: boolean } {
  if (!next) return { changed: false };
  if (next.status === "acknowledged") return { value: next, changed: false };
  const changed = signoffPersonChanged(existing, next);
  if (changed) {
    return {
      changed: true,
      value: compactJdSignoff({
        employeeId: next.employeeId,
        userId: next.userId,
        name: next.name,
        designation: next.designation,
        status: "pending",
      }),
    };
  }
  const linked = existing ? mergeResolvedSignoffLogin(existing, next) : null;
  if (linked) return { value: linked, changed: false };
  return { changed: false };
}

export async function createJobDescription(
  data: Omit<
    JobDescription,
    "id" | "createdAt" | "updatedAt" | "createdBy" | "status"
  >,
  actorId: string
): Promise<JobDescription> {
  const existing = (await listJobDescriptions()).filter(
    (j) => j.employeeId === data.employeeId && j.status !== "obsolete"
  );
  if (existing.length) {
    throw new Error("This employee already has a Job Description — edit the existing record");
  }

  const jdNo = normalizeJdNo(data.jdNo || "");
  await assertUniqueJdNo(jdNo);

  const version =
    Number.isInteger(data.version) && data.version >= 0 ? data.version : 1;

  const id = generateId("jd");
  const now = nowISO();
  let absenceHandoverUserId = data.absenceHandoverUserId;
  if (data.absenceHandoverEmployeeId && !absenceHandoverUserId) {
    absenceHandoverUserId =
      (await resolveLinkedUserUid(data.absenceHandoverEmployeeId)) || undefined;
  }
  const assignedBy = await hydrateSignoffUserId(data.assignedBy);
  const acceptedBy = await hydrateSignoffUserId(data.acceptedBy);
  const handoverPending = Boolean(
    data.absenceHandoverEmployeeId || absenceHandoverUserId
  );
  const jd: JobDescription = {
    ...data,
    id,
    jdNo,
    version,
    status: "draft",
    ...(absenceHandoverUserId ? { absenceHandoverUserId } : {}),
    ...(handoverPending ? { absenceHandoverStatus: "pending" as const } : {}),
    ...(assignedBy ? { assignedBy } : {}),
    ...(acceptedBy ? { acceptedBy } : {}),
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  const payload = sanitizeForFirestore(jd);

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.jobDescriptions = [jd, ...store.jobDescriptions.filter((j) => j.id !== id)];
    writeTrainingStore(store);
    await notifyAllJdSignoffs(jd, actorId);
    return jd;
  }

  await setDoc(doc(db, COLLECTIONS.jobDescriptions, id), payload);
  notifyTrainingUpdated();
  await notifyAllJdSignoffs(jd, actorId);
  return jd;
}

export async function getJobDescription(id: string): Promise<JobDescription | null> {
  if (preferTrainingLocal()) {
    return readTrainingStore().jobDescriptions.find((j) => j.id === id) || null;
  }
  const snap = await getDoc(doc(db, COLLECTIONS.jobDescriptions, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as JobDescription) : null;
}

export async function approveJobDescription(
  id: string,
  actorId: string
): Promise<JobDescription> {
  const now = nowISO();
  return updateJobDescription(
    id,
    {
      status: "approved",
      approvedBy: actorId,
      approvedAt: now,
    },
    actorId
  );
}

export async function listJobDescriptions(filters?: {
  employeeId?: string;
  handoverEmployeeId?: string;
  handoverUserId?: string;
}): Promise<JobDescription[]> {
  if (preferTrainingLocal()) {
    let rows = [...readTrainingStore().jobDescriptions];
    if (filters?.employeeId) {
      rows = rows.filter((j) => j.employeeId === filters.employeeId);
    }
    if (filters?.handoverEmployeeId) {
      rows = rows.filter((j) => j.absenceHandoverEmployeeId === filters.handoverEmployeeId);
    }
    if (filters?.handoverUserId) {
      rows = rows.filter((j) => j.absenceHandoverUserId === filters.handoverUserId);
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (filters?.handoverEmployeeId) {
    const q = query(
      collection(db, COLLECTIONS.jobDescriptions),
      where("absenceHandoverEmployeeId", "==", filters.handoverEmployeeId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as JobDescription)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (filters?.handoverUserId) {
    const q = query(
      collection(db, COLLECTIONS.jobDescriptions),
      where("absenceHandoverUserId", "==", filters.handoverUserId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as JobDescription)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (filters?.employeeId) {
    const q = query(
      collection(db, COLLECTIONS.jobDescriptions),
      where("employeeId", "==", filters.employeeId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as JobDescription)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const snap = await getDocs(collection(db, COLLECTIONS.jobDescriptions));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as JobDescription)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const JD_ACK_CLEAR_FIELDS = [
  "absenceHandoverAcknowledgedAt",
  "absenceHandoverAcknowledgedBy",
  "absenceHandoverAcknowledgedByName",
  "absenceHandoverSignatureText",
] as const;

export async function updateJobDescription(
  id: string,
  updates: Partial<Omit<JobDescription, "id" | "createdAt" | "createdBy">>,
  actorId: string
): Promise<JobDescription> {
  const now = nowISO();
  const existing = await getJobDescription(id);
  if (!existing) throw new Error("Job Description not found");

  const { employeeId: ignoredEmployeeId, ...safeUpdates } = updates;
  void ignoredEmployeeId;
  if (safeUpdates.jdNo !== undefined) {
    const jdNo = normalizeJdNo(safeUpdates.jdNo);
    await assertUniqueJdNo(jdNo, id);
    safeUpdates.jdNo = jdNo;
  }
  if (safeUpdates.version !== undefined) {
    if (!Number.isInteger(safeUpdates.version) || safeUpdates.version < 0) {
      throw new Error("Revision no. must be a whole number");
    }
  }

  const handoverChanged =
    safeUpdates.absenceHandoverEmployeeId !== undefined &&
    safeUpdates.absenceHandoverEmployeeId !== existing.absenceHandoverEmployeeId;

  if (handoverChanged) {
    safeUpdates.absenceHandoverStatus = "pending";
    for (const field of JD_ACK_CLEAR_FIELDS) {
      (safeUpdates as Record<string, unknown>)[field] = undefined;
    }
  }

  if (safeUpdates.absenceHandoverEmployeeId && !safeUpdates.absenceHandoverUserId) {
    const linkedUid = await resolveLinkedUserUid(safeUpdates.absenceHandoverEmployeeId);
    if (linkedUid) safeUpdates.absenceHandoverUserId = linkedUid;
  }

  if (handoverChanged && !safeUpdates.absenceHandoverUserId) {
    (safeUpdates as Record<string, unknown>).absenceHandoverUserId = undefined;
  }

  let assignedChanged = false;
  let acceptedChanged = false;
  if (safeUpdates.assignedBy) {
    const next = await hydrateSignoffUserId(safeUpdates.assignedBy);
    if (next?.status === "acknowledged") {
      safeUpdates.assignedBy = next;
    } else {
      assignedChanged = signoffPersonChanged(existing.assignedBy, next);
      if (assignedChanged && next) {
        safeUpdates.assignedBy = compactJdSignoff({
          employeeId: next.employeeId,
          userId: next.userId,
          name: next.name,
          designation: next.designation,
          status: "pending",
        });
      } else {
        const linked =
          existing.assignedBy && next
            ? mergeResolvedSignoffLogin(existing.assignedBy, next)
            : null;
        if (linked) {
          safeUpdates.assignedBy = linked;
        } else {
          delete safeUpdates.assignedBy;
        }
      }
    }
  }
  if (safeUpdates.acceptedBy) {
    const next = await hydrateSignoffUserId(safeUpdates.acceptedBy);
    if (next?.status === "acknowledged") {
      safeUpdates.acceptedBy = next;
    } else {
      acceptedChanged = signoffPersonChanged(existing.acceptedBy, next);
      if (acceptedChanged && next) {
        safeUpdates.acceptedBy = compactJdSignoff({
          employeeId: next.employeeId,
          userId: next.userId,
          name: next.name,
          designation: next.designation,
          status: "pending",
        });
      } else {
        const linked =
          existing.acceptedBy && next
            ? mergeResolvedSignoffLogin(existing.acceptedBy, next)
            : null;
        if (linked) {
          safeUpdates.acceptedBy = linked;
        } else {
          delete safeUpdates.acceptedBy;
        }
      }
    }
  }

  const localPayload = {
    ...safeUpdates,
    updatedAt: now,
    updatedBy: actorId,
  };

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    const current = store.jobDescriptions.find((j) => j.id === id);
    if (!current) throw new Error("Job Description not found");
    const updated: JobDescription = { ...current, ...localPayload };
    for (const field of JD_ACK_CLEAR_FIELDS) {
      if (updated[field] === undefined) delete updated[field];
    }
    if (updated.absenceHandoverUserId === undefined) {
      delete updated.absenceHandoverUserId;
    }
    store.jobDescriptions = store.jobDescriptions.map((j) => (j.id === id ? updated : j));
    writeTrainingStore(store);
    if (handoverChanged) await notifyJdAbsenceHandover(updated, actorId);
    if (assignedChanged) await notifyJdSignoff(updated, "assigned_by", actorId);
    if (acceptedChanged) await notifyJdSignoff(updated, "accepted_by", actorId);
    return updated;
  }

  const remotePayload: Record<string, unknown> = {
    updatedAt: now,
    updatedBy: actorId,
  };
  for (const [key, value] of Object.entries(safeUpdates)) {
    remotePayload[key] =
      value === undefined ? deleteField() : sanitizeForFirestore(value);
  }

  try {
    await updateDoc(
      doc(db, COLLECTIONS.jobDescriptions, id),
      remotePayload as { [key: string]: unknown }
    );
    const snap = await getDoc(doc(db, COLLECTIONS.jobDescriptions, id));
    if (snap.exists()) {
      notifyTrainingUpdated();
      const updated = { id: snap.id, ...snap.data() } as JobDescription;
      if (handoverChanged) await notifyJdAbsenceHandover(updated, actorId);
      if (assignedChanged) await notifyJdSignoff(updated, "assigned_by", actorId);
      if (acceptedChanged) await notifyJdSignoff(updated, "accepted_by", actorId);
      return updated;
    }
    throw new Error("Job Description not found");
  } catch (err) {
    if (err instanceof Error && err.message === "Job Description not found") throw err;
    throw new Error(
      err instanceof Error ? err.message : "Failed to update job description in Firebase"
    );
  }
}

export async function acknowledgeJdSignoff(
  id: string,
  slotInput: string | null | undefined,
  actor: { uid: string; name: string; employeeId?: string }
): Promise<JobDescription> {
  const slot = parseJdSignoffSlot(slotInput);
  const jd = await getJobDescription(id);
  if (!jd) throw new Error("Job Description not found");
  const signoff = getJdSignoff(jd, slot);
  if (!signoff || (!signoff.employeeId && !signoff.userId)) {
    throw new Error("This Job Description has no person named for that signature");
  }
  const extraIds = extraEmployeeIdsFromEmployees(actor, readLifecycleStore().employees);
  if (!isJdSignoffParty(signoff, actor, extraIds)) {
    throw new Error("Only the named person can approve this signature");
  }
  if (!isJdSignoffPending(jd, slot)) {
    throw new Error("This signature is already approved");
  }

  const now = nowISO();
  const name = (actor.name || signoff.name || "Assignee").trim();
  const signature = buildJdComputerGeneratedSignature(name, now);

  if (slot === "absence_handover") {
    return updateJobDescription(
      id,
      {
        absenceHandoverStatus: "acknowledged",
        absenceHandoverAcknowledgedAt: now,
        absenceHandoverAcknowledgedBy: actor.uid,
        absenceHandoverAcknowledgedByName: name,
        absenceHandoverSignatureText: signature,
      },
      actor.uid
    );
  }

  const key = slot === "assigned_by" ? "assignedBy" : "acceptedBy";
  return updateJobDescription(
    id,
    {
      [key]: compactJdSignoff({
        ...signoff,
        status: "acknowledged",
        acknowledgedAt: now,
        acknowledgedBy: actor.uid,
        acknowledgedByName: name,
        signatureText: signature,
      }),
    },
    actor.uid
  );
}

export async function acknowledgeJdAbsenceHandover(
  id: string,
  actor: { uid: string; name: string; employeeId?: string }
): Promise<JobDescription> {
  return acknowledgeJdSignoff(id, "absence_handover", actor);
}

async function clearEmployeeJdLink(employeeId: string, jdId: string): Promise<void> {
  if (preferTrainingLocal()) {
    const emp = readLifecycleStore().employees.find((e) => e.id === employeeId);
    if (emp?.jdId === jdId) {
      upsertDemoEmployee({ ...emp, jdId: undefined, updatedAt: nowISO() });
    }
    return;
  }
  const empRef = doc(db, COLLECTIONS.employees, employeeId);
  const empSnap = await getDoc(empRef);
  if (empSnap.exists() && (empSnap.data() as { jdId?: string }).jdId === jdId) {
    await updateDoc(empRef, { jdId: deleteField(), updatedAt: nowISO() });
  }
}

export async function deleteJobDescription(id: string): Promise<void> {
  const jd = await getJobDescription(id);
  if (!jd) throw new Error("Job Description not found");

  const tnis = await listTNIs();
  if (tnis.some((t) => t.jdId === id)) {
    throw new Error("Cannot delete — TNI records reference this Job Description");
  }

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.jobDescriptions = store.jobDescriptions.filter((j) => j.id !== id);
    writeTrainingStore(store);
    await clearEmployeeJdLink(jd.employeeId, id);
    return;
  }

  await deleteDoc(doc(db, COLLECTIONS.jobDescriptions, id));
  await clearEmployeeJdLink(jd.employeeId, id);
  notifyTrainingUpdated();
}

export async function createTNI(
  data: Omit<
    TrainingNeedIdentification,
    "id" | "createdAt" | "updatedAt" | "createdBy" | "version" | "status"
  >,
  actorId: string
): Promise<TrainingNeedIdentification> {
  const existing = (await listTNIs()).filter((t) => t.employeeId === data.employeeId);
  if (existing.length) {
    throw new Error("This employee already has a TNI — edit the existing record");
  }

  const id = generateId("tni");
  const now = nowISO();
  const preparedBySignoff = await hydrateSignoffUserId(data.preparedBySignoff);
  const approvedBySignoff = await hydrateSignoffUserId(data.approvedBySignoff);
  const tni: TrainingNeedIdentification = {
    ...data,
    needs: data.needs.map((n) => {
      const item: TrainingNeedIdentification["needs"][number] = {
        id: n.id,
        topic: n.topic,
        priority: n.priority,
        rationale: n.rationale || "",
        status: n.status || "identified",
      };
      if (n.sopId) item.sopId = n.sopId;
      if (n.targetCompletionDate) item.targetCompletionDate = n.targetCompletionDate;
      return item;
    }),
    id,
    version: 1,
    status: "submitted",
    ...(preparedBySignoff ? { preparedBySignoff } : {}),
    ...(approvedBySignoff ? { approvedBySignoff } : {}),
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  const payload = sanitizeForFirestore(tni);

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.tnis = [tni, ...store.tnis.filter((t) => t.id !== id)];
    writeTrainingStore(store);
    await notifyAllTniSignoffs(tni, actorId);
    return tni;
  }

  await setDoc(doc(db, COLLECTIONS.tni, id), payload);
  notifyTrainingUpdated();
  await notifyAllTniSignoffs(tni, actorId);
  return tni;
}

export async function getTNI(id: string): Promise<TrainingNeedIdentification | null> {
  if (preferTrainingLocal()) {
    return readTrainingStore().tnis.find((t) => t.id === id) || null;
  }
  const snap = await getDoc(doc(db, COLLECTIONS.tni, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as TrainingNeedIdentification) : null;
}

export async function approveTNI(
  id: string,
  actorId: string
): Promise<TrainingNeedIdentification> {
  const now = nowISO();
  return updateTNI(
    id,
    {
      status: "approved",
      approvedBy: actorId,
      approvedAt: now,
    },
    actorId
  );
}

/** Push any local-only TNI records that are missing from Firestore. */
export async function syncLocalTnisToFirebase(): Promise<number> {
  if (preferTrainingLocal()) return 0;
  const localRows = [...readTrainingStore().tnis];
  if (!localRows.length) return 0;

  let remoteIds = new Set<string>();
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.tni));
    remoteIds = new Set(snap.docs.map((d) => d.id));
  } catch (err) {
    console.error("[syncLocalTnisToFirebase] list failed:", err);
    return 0;
  }

  let synced = 0;
  for (const tni of localRows) {
    if (remoteIds.has(tni.id)) continue;
    try {
      await setDoc(doc(db, COLLECTIONS.tni, tni.id), sanitizeForFirestore(tni));
      synced += 1;
    } catch (err) {
      console.error(`[syncLocalTnisToFirebase] failed for ${tni.id}:`, err);
    }
  }
  return synced;
}

export async function listTNIs(filters?: {
  employeeId?: string;
}): Promise<TrainingNeedIdentification[]> {
  if (preferTrainingLocal()) {
    let rows = [...readTrainingStore().tnis];
    if (filters?.employeeId) {
      rows = rows.filter((t) => t.employeeId === filters.employeeId);
    }
    return rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  if (filters?.employeeId) {
    const q = query(
      collection(db, COLLECTIONS.tni),
      where("employeeId", "==", filters.employeeId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as TrainingNeedIdentification)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  const snap = await getDocs(collection(db, COLLECTIONS.tni));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TrainingNeedIdentification)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function updateTNI(
  id: string,
  updates: Partial<
    Omit<TrainingNeedIdentification, "id" | "createdAt" | "createdBy" | "version">
  >,
  actorId: string
): Promise<TrainingNeedIdentification> {
  const now = nowISO();
  const existing = await getTNI(id);
  if (!existing) throw new Error("TNI not found");

  const { employeeId: ignoredEmployeeId, jdId: ignoredJdId, ...safeUpdates } = updates;
  void ignoredEmployeeId;
  void ignoredJdId;
  const cleanedNeeds = safeUpdates.needs?.map((n) => {
    const item: TrainingNeedIdentification["needs"][number] = {
      id: n.id,
      topic: n.topic,
      priority: n.priority,
      rationale: n.rationale || "",
      status: n.status || "identified",
    };
    if (n.sopId) item.sopId = n.sopId;
    if (n.targetCompletionDate) item.targetCompletionDate = n.targetCompletionDate;
    return item;
  });

  let preparedChanged = false;
  let approvedChanged = false;
  if (safeUpdates.preparedBySignoff) {
    const next = await hydrateSignoffUserId(safeUpdates.preparedBySignoff);
    const result = nextPendingSignoff(existing.preparedBySignoff, next);
    preparedChanged = result.changed;
    if (result.value) safeUpdates.preparedBySignoff = result.value;
    else delete safeUpdates.preparedBySignoff;
  }
  if (safeUpdates.approvedBySignoff) {
    const next = await hydrateSignoffUserId(safeUpdates.approvedBySignoff);
    const result = nextPendingSignoff(existing.approvedBySignoff, next);
    approvedChanged = result.changed;
    if (result.value) safeUpdates.approvedBySignoff = result.value;
    else delete safeUpdates.approvedBySignoff;
  }

  const localPayload = {
    ...safeUpdates,
    ...(cleanedNeeds ? { needs: cleanedNeeds } : {}),
    updatedAt: now,
    updatedBy: actorId,
  };

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    const current = store.tnis.find((t) => t.id === id);
    if (!current) throw new Error("TNI not found");
    const updated: TrainingNeedIdentification = { ...current, ...localPayload };
    store.tnis = store.tnis.map((t) => (t.id === id ? updated : t));
    writeTrainingStore(store);
    if (preparedChanged) await notifyTniSignoff(updated, "prepared_by", actorId);
    if (approvedChanged) await notifyTniSignoff(updated, "approved_by", actorId);
    return updated;
  }

  try {
    await updateDoc(doc(db, COLLECTIONS.tni, id), sanitizeForFirestore(localPayload));
    const snap = await getDoc(doc(db, COLLECTIONS.tni, id));
    if (snap.exists()) {
      notifyTrainingUpdated();
      const updated = { id: snap.id, ...snap.data() } as TrainingNeedIdentification;
      if (preparedChanged) await notifyTniSignoff(updated, "prepared_by", actorId);
      if (approvedChanged) await notifyTniSignoff(updated, "approved_by", actorId);
      return updated;
    }
    throw new Error("TNI not found");
  } catch (err) {
    if (err instanceof Error && err.message === "TNI not found") throw err;
    throw new Error(err instanceof Error ? err.message : "Failed to update TNI in Firebase");
  }
}

export async function acknowledgeTniSignoff(
  id: string,
  slotInput: string | null | undefined,
  actor: { uid: string; name: string; employeeId?: string }
): Promise<TrainingNeedIdentification> {
  const slot = parseTniSignoffSlot(slotInput);
  const tni = await getTNI(id);
  if (!tni) throw new Error("TNI not found");
  const signoff = getTniSignoff(tni, slot);
  if (!signoff || (!signoff.employeeId && !signoff.userId)) {
    throw new Error("This TNI has no person named for that signature");
  }
  const extraIds = extraEmployeeIdsFromEmployees(actor, readLifecycleStore().employees);
  if (!isJdSignoffParty(signoff, actor, extraIds)) {
    throw new Error("Only the named person can approve this signature");
  }
  if (!isTniSignoffPending(tni, slot)) {
    throw new Error("This signature is already approved");
  }

  const now = nowISO();
  const name = (actor.name || signoff.name || "Assignee").trim();
  const key = slot === "approved_by" ? "approvedBySignoff" : "preparedBySignoff";
  const patch: Partial<TrainingNeedIdentification> = {
    [key]: compactJdSignoff({
      ...signoff,
      status: "acknowledged",
      acknowledgedAt: now,
      acknowledgedBy: actor.uid,
      acknowledgedByName: name,
      signatureText: buildJdComputerGeneratedSignature(name, now),
    }),
  };
  if (slot === "approved_by" && tni.status === "submitted") {
    patch.status = "approved";
    patch.approvedBy = actor.uid;
    patch.approvedAt = now;
  }
  return updateTNI(id, patch, actor.uid);
}

async function clearEmployeeTniLink(employeeId: string, tniId: string): Promise<void> {
  if (preferTrainingLocal()) {
    const emp = readLifecycleStore().employees.find((e) => e.id === employeeId);
    if (emp?.tniId === tniId) {
      upsertDemoEmployee({ ...emp, tniId: undefined, updatedAt: nowISO() });
    }
    return;
  }
  const empRef = doc(db, COLLECTIONS.employees, employeeId);
  const empSnap = await getDoc(empRef);
  if (empSnap.exists() && (empSnap.data() as { tniId?: string }).tniId === tniId) {
    await updateDoc(empRef, { tniId: deleteField(), updatedAt: nowISO() });
  }
}

export async function deleteTNI(id: string): Promise<void> {
  const tni = await getTNI(id);
  if (!tni) throw new Error("TNI not found");

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.tnis = store.tnis.filter((t) => t.id !== id);
    writeTrainingStore(store);
    await clearEmployeeTniLink(tni.employeeId, id);
    return;
  }

  await deleteDoc(doc(db, COLLECTIONS.tni, id));
  await clearEmployeeTniLink(tni.employeeId, id);
  notifyTrainingUpdated();
}

export async function listTrainers(): Promise<TrainerProfile[]> {
  if (preferTrainingLocal()) {
    return readTrainingStore().trainers.filter((t) => t.isActive);
  }
  const snap = await getDocs(collection(db, COLLECTIONS.trainers));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TrainerProfile)
    .filter((t) => t.isActive);
}

/** Resolve trainer profile by Firestore doc id or linked user id (Firebase UID). */
export async function getTrainerProfile(trainerRef: string): Promise<TrainerProfile | null> {
  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    return (
      store.trainers.find((t) => t.id === trainerRef || t.userId === trainerRef) || null
    );
  }
  const byId = await getDoc(doc(db, COLLECTIONS.trainers, trainerRef));
  if (byId.exists()) {
    return { id: byId.id, ...byId.data() } as TrainerProfile;
  }
  const byUser = query(
    collection(db, COLLECTIONS.trainers),
    where("userId", "==", trainerRef),
    limit(1)
  );
  const snap = await getDocs(byUser);
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...d.data() } as TrainerProfile;
}

/** Ensure trainer profiles exist for users with role=trainer (demo + first visit). */
export async function ensureTrainerProfilesFromUsers(
  users: { uid: string; displayName: string; departmentId?: string; role: string }[]
): Promise<TrainerProfile[]> {
  const trainers = users.filter((u) => u.role === "trainer");
  const existing = await listTrainers();
  const byUser = new Set(existing.map((t) => t.userId));
  const created: TrainerProfile[] = [];

  for (const u of trainers) {
    if (byUser.has(u.uid)) continue;
    const id = generateId("tr");
    const now = nowISO();
    const profile: TrainerProfile = {
      id,
      userId: u.uid,
      specializations: ["GMP", "SOP Training"],
      departmentIds: u.departmentId ? [u.departmentId] : [],
      qualifications: [],
      isActive: true,
      totalSessionsConducted: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: u.uid,
    };
    created.push(profile);
    if (preferTrainingLocal() || isDemoMode()) {
      const store = readTrainingStore();
      store.trainers.push(profile);
      writeTrainingStore(store);
    } else {
      await setDoc(doc(db, COLLECTIONS.trainers, id), profile);
    }
  }

  return [...existing, ...created];
}

/** Update assignment status after exam (demo + Firebase). */
export async function updateAssignmentAfterAssessment(params: {
  assignmentId: string;
  passed: boolean;
  score: number;
  attemptId: string;
  actorId: string;
}): Promise<void> {
  const now = nowISO();
  const status = params.passed ? "passed" : "failed";

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.assignments = store.assignments.map((a) =>
      a.id === params.assignmentId
        ? {
            ...a,
            status,
            score: params.score,
            passed: params.passed,
            attemptCount: (a.attemptCount || 0) + 1,
            assessmentAttemptId: params.attemptId,
            updatedAt: now,
            updatedBy: params.actorId,
          }
        : a
    );
    writeTrainingStore(store);
    return;
  }

  const snap = await getDoc(doc(db, COLLECTIONS.trainingAssignments, params.assignmentId));
  const prev = snap.data() as TrainingAssignment | undefined;
  await updateDoc(doc(db, COLLECTIONS.trainingAssignments, params.assignmentId), {
    status,
    score: params.score,
    passed: params.passed,
    attemptCount: (prev?.attemptCount || 0) + 1,
    assessmentAttemptId: params.attemptId,
    updatedAt: now,
    updatedBy: params.actorId,
  });
}
