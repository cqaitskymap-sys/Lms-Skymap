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
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import type {
  TrainingAssignment,
  TrainingSession,
  TrainingAttendance,
  JobDescription,
  TrainingNeedIdentification,
  Notification,
  TrainerProfile,
} from "@/types";
import { generateId, nowISO } from "@/lib/services/helpers";
import {
  preferTrainingLocal,
  readTrainingStore,
  writeTrainingStore,
} from "@/lib/training/demo-store";
import { readLifecycleStore } from "@/lib/lifecycle/demo-store";
import { isDemoMode } from "@/lib/demo/data";

async function resolveNotifyUserId(employeeId: string): Promise<string> {
  const local = readLifecycleStore().employees.find((e) => e.id === employeeId);
  if (local?.userId) return local.userId;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.employees, employeeId));
    if (snap.exists()) {
      const uid = (snap.data() as { userId?: string }).userId;
      if (uid) return uid;
    }
  } catch {
    /* fall through */
  }
  return employeeId;
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
}): Promise<{ assignments: TrainingAssignment[]; session: TrainingSession }> {
  const now = nowISO();
  const assignments: TrainingAssignment[] = [];
  let local = preferTrainingLocal();

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

  // If session landed in local store (Firestore fallback), keep writing locally
  if (!local && readTrainingStore().sessions.some((s) => s.id === session.id)) {
    local = true;
  }

  for (const employeeId of params.employeeIds) {
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
      const exists = store.assignments.some(
        (a) =>
          a.employeeId === employeeId &&
          a.sopId === params.sopId &&
          a.status !== "passed" &&
          a.status !== "failed"
      );
      if (!exists) store.assignments.push(assignment);
      writeTrainingStore(store);
    } else {
      try {
        await setDoc(doc(db, COLLECTIONS.trainingAssignments, id), assignment);
      } catch {
        local = true;
        const store = readTrainingStore();
        store.assignments.push(assignment);
        writeTrainingStore(store);
      }
    }

    await createNotification({
      userId: await resolveNotifyUserId(employeeId),
      type: "assignment",
      title: "New SOP Training Assigned",
      message: "You have been assigned a new SOP training. Please review the materials.",
      link: `/dashboard/training/sessions/${session.id}`,
      actorId: params.actorId,
    });
  }

  // Seed attendance roster on the session
  const roster: TrainingAttendance[] = params.employeeIds.map((employeeId) => ({
    employeeId,
    present: false,
  }));
  if (local) {
    const store = readTrainingStore();
    store.sessions = store.sessions.map((s) =>
      s.id === session.id ? { ...s, attendance: roster, updatedAt: now } : s
    );
    writeTrainingStore(store);
  } else {
    try {
      await updateDoc(doc(db, COLLECTIONS.trainingSessions, session.id), {
        attendance: roster,
        updatedAt: now,
      });
    } catch {
      const store = readTrainingStore();
      const existing = store.sessions.find((s) => s.id === session.id);
      if (existing) {
        store.sessions = store.sessions.map((s) =>
          s.id === session.id ? { ...s, attendance: roster, updatedAt: now } : s
        );
      } else {
        store.sessions.push({ ...session, attendance: roster });
      }
      writeTrainingStore(store);
    }
  }

  return { assignments, session: { ...session, attendance: roster } };
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

  try {
    await setDoc(doc(db, COLLECTIONS.trainingSessions, id), session);
  } catch {
    const store = readTrainingStore();
    store.sessions.push(session);
    writeTrainingStore(store);
  }
  return session;
}

export async function getTrainingSession(id: string): Promise<TrainingSession | null> {
  if (preferTrainingLocal()) {
    return readTrainingStore().sessions.find((s) => s.id === id) || null;
  }
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.trainingSessions, id));
    if (!snap.exists()) {
      return readTrainingStore().sessions.find((s) => s.id === id) || null;
    }
    return { id: snap.id, ...snap.data() } as TrainingSession;
  } catch {
    return readTrainingStore().sessions.find((s) => s.id === id) || null;
  }
}

export async function listTrainingSessions(): Promise<TrainingSession[]> {
  const localRows = [...readTrainingStore().sessions];
  if (preferTrainingLocal()) {
    return localRows.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.trainingSessions));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingSession);
    const byId = new Map<string, TrainingSession>();
    for (const r of [...rows, ...localRows]) byId.set(r.id, r);
    return [...byId.values()].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  } catch {
    return localRows.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }
}

export async function listTrainingAssignments(): Promise<TrainingAssignment[]> {
  const localRows = [...readTrainingStore().assignments];
  if (preferTrainingLocal()) {
    return localRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.trainingAssignments));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment);
    const byId = new Map<string, TrainingAssignment>();
    for (const r of [...rows, ...localRows]) byId.set(r.id, r);
    return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return localRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export async function markAttendance(
  sessionId: string,
  attendance: TrainingAttendance[],
  actorId: string
): Promise<void> {
  const now = nowISO();
  const inLocal = readTrainingStore().sessions.some((s) => s.id === sessionId);
  if (preferTrainingLocal() || inLocal) {
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
  const local =
    preferTrainingLocal() ||
    readTrainingStore().sessions.some((s) => s.id === sessionId);

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
    session = sessionSnap.data() as TrainingSession;
  }

  if (!session) return;
  const present = session.attendance.filter((a) => a.present);

  for (const att of present) {
    if (local) {
      const store = readTrainingStore();
      store.assignments = store.assignments.map((a) =>
        a.employeeId === att.employeeId && a.sessionId === sessionId
          ? {
              ...a,
              status: "assessment_pending",
              trainingCompletedAt: now,
              updatedAt: now,
              updatedBy: actorId,
            }
          : a
      );
      writeTrainingStore(store);
    } else {
      const q = query(
        collection(db, COLLECTIONS.trainingAssignments),
        where("employeeId", "==", att.employeeId),
        where("sessionId", "==", sessionId)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(d.ref, {
          status: "assessment_pending",
          trainingCompletedAt: now,
          updatedAt: now,
          updatedBy: actorId,
        });
      }
    }

    await createNotification({
      userId: await resolveNotifyUserId(att.employeeId),
      type: "assessment",
      title: "Assessment Ready",
      message: "Your training session is complete. Please take the assessment.",
      link: `/dashboard/exams`,
      actorId,
    });
  }
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
    return readTrainingStore().assignments.filter((a) => a.employeeId === employeeId);
  }
}

export async function createJobDescription(
  data: Omit<
    JobDescription,
    "id" | "createdAt" | "updatedAt" | "createdBy" | "version" | "status"
  >,
  actorId: string
): Promise<JobDescription> {
  const id = generateId("jd");
  const now = nowISO();
  const jd: JobDescription = {
    ...data,
    id,
    version: 1,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.jobDescriptions.unshift(jd);
    writeTrainingStore(store);
    return jd;
  }

  try {
    await setDoc(doc(db, COLLECTIONS.jobDescriptions, id), jd);
  } catch {
    const store = readTrainingStore();
    store.jobDescriptions.unshift(jd);
    writeTrainingStore(store);
  }
  return jd;
}

export async function listJobDescriptions(): Promise<JobDescription[]> {
  if (preferTrainingLocal()) {
    return [...readTrainingStore().jobDescriptions];
  }
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.jobDescriptions));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as JobDescription);
    if (rows.length) return rows;
  } catch {
    /* fall through */
  }
  return [...readTrainingStore().jobDescriptions];
}

export async function createTNI(
  data: Omit<
    TrainingNeedIdentification,
    "id" | "createdAt" | "updatedAt" | "createdBy" | "version" | "status"
  >,
  actorId: string
): Promise<TrainingNeedIdentification> {
  const id = generateId("tni");
  const now = nowISO();
  const tni: TrainingNeedIdentification = {
    ...data,
    id,
    version: 1,
    status: "submitted",
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.tnis.unshift(tni);
    writeTrainingStore(store);
    return tni;
  }

  try {
    await setDoc(doc(db, COLLECTIONS.tni, id), tni);
  } catch {
    const store = readTrainingStore();
    store.tnis.unshift(tni);
    writeTrainingStore(store);
  }
  return tni;
}

export async function listTNIs(): Promise<TrainingNeedIdentification[]> {
  if (preferTrainingLocal()) {
    return [...readTrainingStore().tnis];
  }
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.tni));
    const rows = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as TrainingNeedIdentification
    );
    if (rows.length) return rows;
  } catch {
    /* fall through */
  }
  return [...readTrainingStore().tnis];
}

export async function listTrainers(): Promise<TrainerProfile[]> {
  if (preferTrainingLocal()) {
    return readTrainingStore().trainers.filter((t) => t.isActive);
  }
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.trainers));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainerProfile);
    if (rows.length) return rows.filter((t) => t.isActive);
  } catch {
    /* fall through */
  }
  return readTrainingStore().trainers.filter((t) => t.isActive);
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

export async function createNotification(params: {
  userId: string;
  type: Notification["type"];
  title: string;
  message: string;
  link?: string;
  actorId: string;
  metadata?: Record<string, string>;
}): Promise<Notification> {
  const id = generateId("notif");
  const now = nowISO();
  const notification: Notification = {
    id,
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    isRead: false,
    createdAt: now,
    updatedAt: now,
    createdBy: params.actorId,
    ...(params.link ? { link: params.link } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };

  if (preferTrainingLocal() || isDemoMode()) {
    const store = readTrainingStore();
    store.notifications.unshift(notification);
    writeTrainingStore(store);
    return notification;
  }

  await setDoc(doc(db, COLLECTIONS.notifications, id), notification);
  return notification;
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const fromTraining = preferTrainingLocal()
    ? readTrainingStore().notifications.filter((n) => n.userId === userId)
    : [];

  const fromLifecycle =
    typeof window !== "undefined"
      ? readLifecycleStore().notifications.filter((n) => n.userId === userId)
      : [];

  if (preferTrainingLocal() || isDemoMode()) {
    return [...fromTraining, ...fromLifecycle].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  try {
    const q = query(
      collection(db, COLLECTIONS.notifications),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification);
    if (rows.length) return rows;
  } catch {
    /* fall through */
  }

  return [...fromTraining, ...fromLifecycle].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  const now = nowISO();
  if (preferTrainingLocal() || isDemoMode()) {
    const store = readTrainingStore();
    store.notifications = store.notifications.map((n) =>
      n.id === id ? { ...n, isRead: true, readAt: now, updatedAt: now } : n
    );
    writeTrainingStore(store);
    return;
  }

  await updateDoc(doc(db, COLLECTIONS.notifications, id), {
    isRead: true,
    readAt: now,
    updatedAt: now,
  });
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
