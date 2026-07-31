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
} from "@/types";
import { generateId, nowISO } from "@/lib/services/helpers";

export async function assignSopTraining(params: {
  employeeIds: string[];
  sopId: string;
  sopVersionId: string;
  trainerId: string;
  departmentId: string;
  dueDate?: string;
  actorId: string;
}): Promise<TrainingAssignment[]> {
  const now = nowISO();
  const assignments: TrainingAssignment[] = [];

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
      status: "assigned",
      dueDate: params.dueDate,
      attemptCount: 0,
      isRetraining: false,
      triggeredBySopRevision: false,
      createdAt: now,
      updatedAt: now,
      createdBy: params.actorId,
    };
    await setDoc(doc(db, COLLECTIONS.trainingAssignments, id), assignment);
    assignments.push(assignment);

    await createNotification({
      userId: employeeId,
      type: "assignment",
      title: "New SOP Training Assigned",
      message: "You have been assigned a new SOP training. Please review the materials.",
      link: `/dashboard/training/${id}`,
      actorId: params.actorId,
    });
  }

  return assignments;
}

export async function createTrainingSession(
  data: Omit<TrainingSession, "id" | "createdAt" | "updatedAt" | "createdBy" | "attendance" | "status">,
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
  await setDoc(doc(db, COLLECTIONS.trainingSessions, id), session);
  return session;
}

export async function markAttendance(
  sessionId: string,
  attendance: TrainingAttendance[],
  actorId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.trainingSessions, sessionId), {
    attendance,
    updatedAt: nowISO(),
    updatedBy: actorId,
  });
}

export async function completeTrainingSession(
  sessionId: string,
  notes: string,
  actorId: string
): Promise<void> {
  const now = nowISO();
  await updateDoc(doc(db, COLLECTIONS.trainingSessions, sessionId), {
    status: "completed",
    completedAt: now,
    notes,
    updatedAt: now,
    updatedBy: actorId,
  });

  const sessionSnap = await getDoc(doc(db, COLLECTIONS.trainingSessions, sessionId));
  const session = sessionSnap.data() as TrainingSession;

  // Mark present employees' assignments as training_completed → assessment_pending
  for (const att of session.attendance.filter((a) => a.present)) {
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
      await createNotification({
        userId: att.employeeId,
        type: "assessment",
        title: "Assessment Ready",
        message: "Your training session is complete. Please take the assessment.",
        link: `/dashboard/exams`,
        actorId,
      });
    }
  }
}

export async function getEmployeeAssignments(employeeId: string): Promise<TrainingAssignment[]> {
  const q = query(
    collection(db, COLLECTIONS.trainingAssignments),
    where("employeeId", "==", employeeId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment);
}

export async function createJobDescription(
  data: Omit<JobDescription, "id" | "createdAt" | "updatedAt" | "createdBy" | "version" | "status">,
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
  await setDoc(doc(db, COLLECTIONS.jobDescriptions, id), jd);
  return jd;
}

export async function createTNI(
  data: Omit<TrainingNeedIdentification, "id" | "createdAt" | "updatedAt" | "createdBy" | "version" | "status">,
  actorId: string
): Promise<TrainingNeedIdentification> {
  const id = generateId("tni");
  const now = nowISO();
  const tni: TrainingNeedIdentification = {
    ...data,
    id,
    version: 1,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };
  await setDoc(doc(db, COLLECTIONS.tni, id), tni);
  return tni;
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
    link: params.link,
    isRead: false,
    metadata: params.metadata,
    createdAt: now,
    updatedAt: now,
    createdBy: params.actorId,
  };
  await setDoc(doc(db, COLLECTIONS.notifications, id), notification);
  return notification;
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const q = query(
    collection(db, COLLECTIONS.notifications),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification);
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.notifications, id), {
    isRead: true,
    readAt: nowISO(),
    updatedAt: nowISO(),
  });
}
