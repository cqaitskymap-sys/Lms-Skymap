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
import {
  readLifecycleStore,
  writeLifecycleStore,
} from "@/lib/lifecycle/demo-store";
import { isDemoMode } from "@/lib/demo/data";

/** Firestore rejects `undefined` field values — strip them before writes. */
function sanitizeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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
  const local = preferTrainingLocal();

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
      await setDoc(doc(db, COLLECTIONS.trainingAssignments, id), assignment);
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
    await updateDoc(doc(db, COLLECTIONS.trainingSessions, session.id), {
      attendance: roster,
      updatedAt: now,
    });
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

  await setDoc(doc(db, COLLECTIONS.trainingSessions, id), session);
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

export async function listTrainingAssignments(): Promise<TrainingAssignment[]> {
  if (preferTrainingLocal()) {
    return [...readTrainingStore().assignments].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }
  const snap = await getDocs(collection(db, COLLECTIONS.trainingAssignments));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  const payload = sanitizeForFirestore(jd);

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.jobDescriptions = [jd, ...store.jobDescriptions.filter((j) => j.id !== id)];
    writeTrainingStore(store);
    return jd;
  }

  await setDoc(doc(db, COLLECTIONS.jobDescriptions, id), payload);
  return jd;
}

export async function listJobDescriptions(): Promise<JobDescription[]> {
  if (preferTrainingLocal()) {
    return [...readTrainingStore().jobDescriptions].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }
  const snap = await getDocs(collection(db, COLLECTIONS.jobDescriptions));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as JobDescription)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateJobDescription(
  id: string,
  updates: Partial<
    Omit<JobDescription, "id" | "createdAt" | "createdBy" | "version">
  >,
  actorId: string
): Promise<JobDescription> {
  const now = nowISO();
  const localPayload = {
    ...updates,
    updatedAt: now,
    updatedBy: actorId,
  };

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    const existing = store.jobDescriptions.find((j) => j.id === id);
    if (!existing) throw new Error("Job Description not found");
    const updated: JobDescription = { ...existing, ...localPayload };
    store.jobDescriptions = store.jobDescriptions.map((j) => (j.id === id ? updated : j));
    writeTrainingStore(store);
    return updated;
  }

  try {
    await updateDoc(doc(db, COLLECTIONS.jobDescriptions, id), localPayload);
    const snap = await getDoc(doc(db, COLLECTIONS.jobDescriptions, id));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as JobDescription;
    throw new Error("Job Description not found");
  } catch (err) {
    if (err instanceof Error && err.message === "Job Description not found") throw err;
    throw new Error(
      err instanceof Error ? err.message : "Failed to update job description in Firebase"
    );
  }
}

export async function deleteJobDescription(id: string): Promise<void> {
  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.jobDescriptions = store.jobDescriptions.filter((j) => j.id !== id);
    writeTrainingStore(store);
    return;
  }
  await deleteDoc(doc(db, COLLECTIONS.jobDescriptions, id));
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
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  const payload = sanitizeForFirestore(tni);

  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.tnis = [tni, ...store.tnis.filter((t) => t.id !== id)];
    writeTrainingStore(store);
    return tni;
  }

  await setDoc(doc(db, COLLECTIONS.tni, id), payload);
  return tni;
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

export async function listTNIs(): Promise<TrainingNeedIdentification[]> {
  if (preferTrainingLocal()) {
    return [...readTrainingStore().tnis].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }
  const snap = await getDocs(collection(db, COLLECTIONS.tni));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TrainingNeedIdentification)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateTNI(
  id: string,
  updates: Partial<
    Omit<TrainingNeedIdentification, "id" | "createdAt" | "createdBy" | "version">
  >,
  actorId: string
): Promise<TrainingNeedIdentification> {
  const now = nowISO();
  const cleanedNeeds = updates.needs?.map((n) => {
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

  const localPayload = {
    ...updates,
    ...(cleanedNeeds ? { needs: cleanedNeeds } : {}),
    updatedAt: now,
    updatedBy: actorId,
  };

  const store = readTrainingStore();
  const existingLocal = store.tnis.find((t) => t.id === id);
  let updated: TrainingNeedIdentification | null = existingLocal
    ? { ...existingLocal, ...localPayload }
    : null;

  if (preferTrainingLocal()) {
    if (!updated) throw new Error("TNI not found");
    store.tnis = store.tnis.map((t) => (t.id === id ? updated! : t));
    writeTrainingStore(store);
    return updated;
  }

  try {
    await updateDoc(doc(db, COLLECTIONS.tni, id), sanitizeForFirestore(localPayload));
    const snap = await getDoc(doc(db, COLLECTIONS.tni, id));
    if (snap.exists()) {
      updated = { id: snap.id, ...snap.data() } as TrainingNeedIdentification;
    }
  } catch {
    if (!updated) throw new Error("TNI not found");
  }

  if (!updated) throw new Error("TNI not found");
  store.tnis = [updated, ...store.tnis.filter((t) => t.id !== id)];
  writeTrainingStore(store);
  return updated;
}

export async function deleteTNI(id: string): Promise<void> {
  if (preferTrainingLocal()) {
    const store = readTrainingStore();
    store.tnis = store.tnis.filter((t) => t.id !== id);
    writeTrainingStore(store);
    return;
  }
  await deleteDoc(doc(db, COLLECTIONS.tni, id));
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

function localNotificationsForUser(userId: string): Notification[] {
  if (typeof window === "undefined") return [];
  const fromTraining = readTrainingStore().notifications.filter(
    (n) => n.userId === userId
  );
  const fromLifecycle = readLifecycleStore().notifications.filter(
    (n) => n.userId === userId
  );
  const byId = new Map<string, Notification>();
  for (const n of [...fromTraining, ...fromLifecycle]) {
    byId.set(n.id, n);
  }
  return [...byId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

function markLocalNotificationRead(id: string, now: string): boolean {
  if (typeof window === "undefined") return false;
  let found = false;

  const training = readTrainingStore();
  if (training.notifications.some((n) => n.id === id)) {
    found = true;
    training.notifications = training.notifications.map((n) =>
      n.id === id ? { ...n, isRead: true, readAt: now, updatedAt: now } : n
    );
    writeTrainingStore(training);
  }

  const lifecycle = readLifecycleStore();
  if (lifecycle.notifications.some((n) => n.id === id)) {
    found = true;
    lifecycle.notifications = lifecycle.notifications.map((n) =>
      n.id === id ? { ...n, isRead: true, readAt: now, updatedAt: now } : n
    );
    writeLifecycleStore(lifecycle);
  }

  return found;
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const local = localNotificationsForUser(userId);

  const fetchRemote = async (): Promise<Notification[] | null> => {
    try {
      const q = query(
        collection(db, COLLECTIONS.notifications),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as Omit<Notification, "id">;
        return { ...data, id: d.id } as Notification;
      });
    } catch {
      return null;
    }
  };

  if (preferTrainingLocal() || isDemoMode()) {
    // Merge API/Firestore notifs (e.g. employee onboard) with local demo stores.
    const remote = await fetchRemote();
    if (!remote?.length) return local;
    const byId = new Map<string, Notification>();
    for (const n of [...remote, ...local]) byId.set(n.id, n);
    return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const remote = await fetchRemote();
  return remote ?? local;
}

export async function markNotificationRead(id: string): Promise<void> {
  const now = nowISO();
  const foundLocal = markLocalNotificationRead(id, now);

  if (preferTrainingLocal() || isDemoMode()) {
    // API-created notifications (e.g. employee onboard) live in Firestore even in demo.
    if (foundLocal) return;
  }

  try {
    await updateDoc(doc(db, COLLECTIONS.notifications, id), {
      isRead: true,
      readAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (!foundLocal) throw err;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const items = await getUserNotifications(userId);
  const unread = items.filter((n) => !n.isRead);
  await Promise.all(unread.map((n) => markNotificationRead(n.id)));
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
