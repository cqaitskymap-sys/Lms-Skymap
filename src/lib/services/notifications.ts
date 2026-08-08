/**
 * In-app notifications — list, mark read, create, delete.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore/lite";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import type { Notification } from "@/types";
import { generateId, nowISO } from "@/lib/services/helpers";
import { isDemoMode } from "@/lib/demo/data";
import {
  preferTrainingLocal,
  readTrainingStore,
  writeTrainingStore,
  notifyTrainingUpdated,
} from "@/lib/training/demo-store";
import {
  readLifecycleStore,
  writeLifecycleStore,
} from "@/lib/lifecycle/demo-store";

export const NOTIFICATIONS_UPDATED_EVENT = "pharma-notifications-updated";

export function notifyNotificationsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

/**
 * Resolve employee doc → Firebase Auth uid for inbox targeting.
 * Never falls back to employeeId (rules require userId == auth.uid).
 */
export async function resolveEmployeeAuthUid(
  employeeId: string
): Promise<string | null> {
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
  return null;
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

async function fetchRemoteNotifications(userId: string): Promise<Notification[]> {
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
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const local = localNotificationsForUser(userId);

  if (preferTrainingLocal() || isDemoMode()) {
    let remote: Notification[] = [];
    try {
      remote = await fetchRemoteNotifications(userId);
    } catch {
      /* demo: remote optional (API-created onboard notifs) */
    }
    if (!remote.length) return local;
    const byId = new Map<string, Notification>();
    for (const n of [...remote, ...local]) byId.set(n.id, n);
    return [...byId.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  return fetchRemoteNotifications(userId);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const items = await getUserNotifications(userId);
  return items.filter((n) => !n.isRead).length;
}

export async function createNotification(params: {
  userId: string;
  type: Notification["type"];
  title: string;
  message: string;
  link?: string;
  actorId: string;
  metadata?: Record<string, string>;
}): Promise<Notification | null> {
  const userId = (params.userId || "").trim();
  if (!userId) {
    console.warn("[notifications] skipped create — missing userId");
    return null;
  }

  const id = generateId("notif");
  const now = nowISO();
  const notification: Notification = {
    id,
    userId,
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
    notifyTrainingUpdated();
    notifyNotificationsUpdated();
    return notification;
  }

  await setDoc(doc(db, COLLECTIONS.notifications, id), notification);
  notifyNotificationsUpdated();
  return notification;
}

/** Create inbox item for an employee if they have a linked Auth account. */
export async function notifyEmployee(params: {
  employeeId: string;
  type: Notification["type"];
  title: string;
  message: string;
  link?: string;
  actorId: string;
  metadata?: Record<string, string>;
}): Promise<Notification | null> {
  const uid = await resolveEmployeeAuthUid(params.employeeId);
  if (!uid) {
    console.warn(
      `[notifications] skipped — employee ${params.employeeId} has no linked Auth user`
    );
    return null;
  }
  return createNotification({
    userId: uid,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link,
    actorId: params.actorId,
    metadata: params.metadata,
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  const now = nowISO();
  const foundLocal = markLocalNotificationRead(id, now);

  if (preferTrainingLocal() || isDemoMode()) {
    if (foundLocal) {
      notifyNotificationsUpdated();
      return;
    }
  }

  try {
    await updateDoc(doc(db, COLLECTIONS.notifications, id), {
      isRead: true,
      readAt: now,
      updatedAt: now,
    });
    notifyNotificationsUpdated();
  } catch (err) {
    if (!foundLocal) throw err;
    notifyNotificationsUpdated();
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const items = await getUserNotifications(userId);
  const unread = items.filter((n) => !n.isRead);
  if (!unread.length) return;
  await Promise.all(unread.map((n) => markNotificationRead(n.id)));
}

export async function deleteNotification(id: string): Promise<void> {
  if (preferTrainingLocal() || isDemoMode()) {
    const training = readTrainingStore();
    if (training.notifications.some((n) => n.id === id)) {
      training.notifications = training.notifications.filter((n) => n.id !== id);
      writeTrainingStore(training);
      notifyTrainingUpdated();
      notifyNotificationsUpdated();
      return;
    }
    const lifecycle = readLifecycleStore();
    if (lifecycle.notifications.some((n) => n.id === id)) {
      lifecycle.notifications = lifecycle.notifications.filter((n) => n.id !== id);
      writeLifecycleStore(lifecycle);
      notifyNotificationsUpdated();
      return;
    }
  }

  await deleteDoc(doc(db, COLLECTIONS.notifications, id));
  notifyNotificationsUpdated();
}
