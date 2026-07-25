/**
 * Induction service — module catalog, HR assignment, study progress, assessment handoff.
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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, COLLECTIONS } from "@/lib/firebase/client";
import type { InductionModule, InductionAssignment, InductionDocument } from "@/types";
import { generateId, nowISO } from "@/lib/services/helpers";
import { isDemoMode } from "@/lib/demo/data";
import {
  readInductionStore,
  writeInductionStore,
} from "@/lib/induction/demo-store";

async function preferLocal(moduleId?: string): Promise<boolean> {
  if (isDemoMode()) return true;
  if (!moduleId) {
    try {
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.inductionModules), where("isActive", "==", true))
      );
      return snap.empty;
    } catch {
      return true;
    }
  }
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.inductionModules, moduleId));
    if (snap.exists()) return false;
    return readInductionStore().modules.some((m) => m.id === moduleId);
  } catch {
    return true;
  }
}

export async function createInductionModule(
  data: Omit<
    InductionModule,
    "id" | "createdAt" | "updatedAt" | "createdBy" | "documents"
  >,
  actorId: string
): Promise<InductionModule> {
  const id = generateId("ind");
  const now = nowISO();
  const inductionModule: InductionModule = {
    ...data,
    id,
    documents: [],
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  if (await preferLocal()) {
    const store = readInductionStore();
    store.modules.push(inductionModule);
    writeInductionStore(store);
    return inductionModule;
  }

  await setDoc(doc(db, COLLECTIONS.inductionModules, id), inductionModule);
  return inductionModule;
}

export async function listInductionModules(): Promise<InductionModule[]> {
  if (await preferLocal()) {
    return readInductionStore()
      .modules.filter((m) => m.isActive)
      .sort((a, b) => a.order - b.order);
  }

  try {
    const q = query(
      collection(db, COLLECTIONS.inductionModules),
      where("isActive", "==", true),
      orderBy("order", "asc")
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InductionModule);
    if (rows.length) return rows;
  } catch {
    /* fall through */
  }
  return readInductionStore()
    .modules.filter((m) => m.isActive)
    .sort((a, b) => a.order - b.order);
}

export async function getInductionModule(id: string): Promise<InductionModule | null> {
  if (await preferLocal(id)) {
    return readInductionStore().modules.find((m) => m.id === id) || null;
  }
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.inductionModules, id));
    if (!snap.exists()) {
      return readInductionStore().modules.find((m) => m.id === id) || null;
    }
    return { id: snap.id, ...snap.data() } as InductionModule;
  } catch {
    return readInductionStore().modules.find((m) => m.id === id) || null;
  }
}

export async function uploadInductionDocument(
  moduleId: string,
  file: File,
  title: string,
  actorId: string
): Promise<InductionDocument> {
  const docId = generateId("doc");
  const type =
    file.type.includes("pdf")
      ? "pdf"
      : file.type.includes("video")
        ? "video"
        : file.name.match(/\.pptx?$/i)
          ? "ppt"
          : "other";

  let downloadUrl: string;
  let storagePath: string;

  if (isDemoMode() || (await preferLocal(moduleId))) {
    storagePath = `demo/induction/${moduleId}/${docId}_${file.name}`;
    downloadUrl =
      typeof URL !== "undefined"
        ? URL.createObjectURL(file)
        : "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
  } else {
    storagePath = `induction/${moduleId}/${docId}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    downloadUrl = await getDownloadURL(storageRef);
  }

  const document: InductionDocument = {
    id: docId,
    title,
    type,
    storagePath,
    downloadUrl,
    fileSize: file.size,
    mimeType: file.type,
    uploadedAt: nowISO(),
    uploadedBy: actorId,
  };

  if (isDemoMode() || (await preferLocal(moduleId))) {
    const store = readInductionStore();
    store.modules = store.modules.map((m) =>
      m.id === moduleId
        ? { ...m, documents: [...(m.documents || []), document], updatedAt: nowISO() }
        : m
    );
    writeInductionStore(store);
    return document;
  }

  const moduleSnap = await getDoc(doc(db, COLLECTIONS.inductionModules, moduleId));
  const inductionModule = moduleSnap.data() as InductionModule;
  const documents = [...(inductionModule.documents || []), document];
  await updateDoc(doc(db, COLLECTIONS.inductionModules, moduleId), {
    documents,
    updatedAt: nowISO(),
    updatedBy: actorId,
  });

  return document;
}

export async function assignInductionModules(
  employeeId: string,
  moduleIds: string[],
  actorId: string
): Promise<InductionAssignment[]> {
  const now = nowISO();
  const assignments: InductionAssignment[] = [];
  const local = await preferLocal(moduleIds[0]);

  for (const moduleId of moduleIds) {
    const id = generateId("inda");
    const assignment: InductionAssignment = {
      id,
      employeeId,
      moduleId,
      status: "not_started",
      progressPercent: 0,
      documentsViewed: [],
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
    };
    assignments.push(assignment);

    if (local) {
      const store = readInductionStore();
      const exists = store.assignments.some(
        (a) => a.employeeId === employeeId && a.moduleId === moduleId && a.status !== "passed"
      );
      if (!exists) store.assignments.push(assignment);
      writeInductionStore(store);
    } else {
      await setDoc(doc(db, COLLECTIONS.inductionAssignments, id), assignment);
    }
  }

  if (!local) {
    await updateDoc(doc(db, COLLECTIONS.employees, employeeId), {
      status: "induction",
      inductionStatus: "in_progress",
      updatedAt: now,
      updatedBy: actorId,
    });
  }

  return assignments;
}

export async function getEmployeeInductionAssignments(
  employeeId: string
): Promise<InductionAssignment[]> {
  if (await preferLocal()) {
    return readInductionStore().assignments.filter((a) => a.employeeId === employeeId);
  }

  try {
    const q = query(
      collection(db, COLLECTIONS.inductionAssignments),
      where("employeeId", "==", employeeId)
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InductionAssignment);
    if (rows.length) return rows;
  } catch {
    /* fall through */
  }
  return readInductionStore().assignments.filter((a) => a.employeeId === employeeId);
}

export async function listAllInductionAssignments(): Promise<InductionAssignment[]> {
  if (await preferLocal()) {
    return [...readInductionStore().assignments];
  }
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.inductionAssignments));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InductionAssignment);
    if (rows.length) return rows;
  } catch {
    /* fall through */
  }
  return [...readInductionStore().assignments];
}

export async function markDocumentViewed(
  assignmentId: string,
  documentId: string,
  actorId: string
): Promise<InductionAssignment | null> {
  const local = await preferLocal();
  let assignment: InductionAssignment | null = null;
  let inductionModule: InductionModule | null = null;

  if (local) {
    const store = readInductionStore();
    assignment = store.assignments.find((a) => a.id === assignmentId) || null;
    if (!assignment) return null;
    inductionModule = store.modules.find((m) => m.id === assignment!.moduleId) || null;
  } else {
    const snap = await getDoc(doc(db, COLLECTIONS.inductionAssignments, assignmentId));
    if (!snap.exists()) return null;
    assignment = { id: snap.id, ...snap.data() } as InductionAssignment;
    const moduleSnap = await getDoc(doc(db, COLLECTIONS.inductionModules, assignment.moduleId));
    inductionModule = moduleSnap.exists()
      ? ({ id: moduleSnap.id, ...moduleSnap.data() } as InductionModule)
      : null;
  }

  if (!assignment || !inductionModule) return null;

  const viewed = Array.from(new Set([...assignment.documentsViewed, documentId]));
  const total = Math.max(inductionModule.documents?.length || 1, 1);
  const progress = Math.min(100, Math.round((viewed.length / total) * 100));
  const now = nowISO();
  const updated: InductionAssignment = {
    ...assignment,
    documentsViewed: viewed,
    progressPercent: progress,
    status: progress >= 100 ? "assessment_pending" : "in_progress",
    startedAt: assignment.startedAt || now,
    updatedAt: now,
    updatedBy: actorId,
  };

  if (local) {
    const store = readInductionStore();
    store.assignments = store.assignments.map((a) => (a.id === assignmentId ? updated : a));
    writeInductionStore(store);
  } else {
    await updateDoc(doc(db, COLLECTIONS.inductionAssignments, assignmentId), {
      documentsViewed: viewed,
      progressPercent: progress,
      status: updated.status,
      startedAt: updated.startedAt,
      updatedAt: now,
      updatedBy: actorId,
    });
  }

  return updated;
}

/** Mark module content as studied (all docs / no-doc modules). */
export async function markModuleStudied(
  assignmentId: string,
  actorId: string
): Promise<InductionAssignment | null> {
  const local = await preferLocal();
  let assignment: InductionAssignment | null = null;
  let inductionModule: InductionModule | null = null;

  if (local) {
    const store = readInductionStore();
    assignment = store.assignments.find((a) => a.id === assignmentId) || null;
    if (!assignment) return null;
    inductionModule = store.modules.find((m) => m.id === assignment!.moduleId) || null;
  } else {
    const snap = await getDoc(doc(db, COLLECTIONS.inductionAssignments, assignmentId));
    if (!snap.exists()) return null;
    assignment = { id: snap.id, ...snap.data() } as InductionAssignment;
    const moduleSnap = await getDoc(doc(db, COLLECTIONS.inductionModules, assignment.moduleId));
    inductionModule = moduleSnap.exists()
      ? ({ id: moduleSnap.id, ...moduleSnap.data() } as InductionModule)
      : null;
  }

  if (!assignment || !inductionModule) return null;

  const allDocIds = (inductionModule.documents || []).map((d) => d.id);
  const now = nowISO();
  const updated: InductionAssignment = {
    ...assignment,
    documentsViewed: allDocIds.length ? allDocIds : assignment.documentsViewed,
    progressPercent: 100,
    status: "assessment_pending",
    startedAt: assignment.startedAt || now,
    updatedAt: now,
    updatedBy: actorId,
  };

  if (local) {
    const store = readInductionStore();
    store.assignments = store.assignments.map((a) => (a.id === assignmentId ? updated : a));
    writeInductionStore(store);
  } else {
    await updateDoc(doc(db, COLLECTIONS.inductionAssignments, assignmentId), {
      documentsViewed: updated.documentsViewed,
      progressPercent: 100,
      status: "assessment_pending",
      startedAt: updated.startedAt,
      updatedAt: now,
      updatedBy: actorId,
    });
  }

  return updated;
}

export type InductionBundleItem = {
  assignment: InductionAssignment;
  module: InductionModule;
};

export async function getEmployeeInductionBundle(
  employeeId: string
): Promise<InductionBundleItem[]> {
  const [assignments, modules] = await Promise.all([
    getEmployeeInductionAssignments(employeeId),
    listInductionModules(),
  ]);
  const byId = new Map(modules.map((m) => [m.id, m]));
  // Include inactive modules still assigned
  const storeMods = readInductionStore().modules;
  for (const m of storeMods) {
    if (!byId.has(m.id)) byId.set(m.id, m);
  }

  return assignments
    .map((assignment) => {
      const module = byId.get(assignment.moduleId);
      if (!module) return null;
      return { assignment, module };
    })
    .filter(Boolean) as InductionBundleItem[];
}

export function overallInductionProgress(items: InductionBundleItem[]): number {
  if (!items.length) return 0;
  const sum = items.reduce((acc, i) => acc + (i.assignment.progressPercent || 0), 0);
  return Math.round(sum / items.length);
}

/** Record assessment outcome against an induction assignment (local + Firestore). */
export async function completeInductionAssessment(params: {
  assignmentId: string;
  attemptId: string;
  percentage: number;
  passed: boolean;
  actorId: string;
  employeeId: string;
}): Promise<void> {
  const now = nowISO();
  const local = await preferLocal();

  if (local) {
    const store = readInductionStore();
    store.assignments = store.assignments.map((a) =>
      a.id === params.assignmentId
        ? {
            ...a,
            status: params.passed ? "passed" : "failed",
            score: params.percentage,
            passed: params.passed,
            assessmentAttemptId: params.attemptId,
            completedAt: params.passed ? now : a.completedAt,
            progressPercent: params.passed ? 100 : a.progressPercent,
            updatedAt: now,
            updatedBy: params.actorId,
          }
        : a
    );
    writeInductionStore(store);

    if (params.passed) {
      const empAssignments = store.assignments.filter(
        (a) => a.employeeId === params.employeeId
      );
      if (empAssignments.length && empAssignments.every((a) => a.status === "passed")) {
        try {
          const { completeInductionLifecycle } = await import("@/lib/services/lifecycle");
          await completeInductionLifecycle(params.employeeId, {
            uid: params.actorId,
            name: "Assessment Engine",
            role: "super_admin",
          });
        } catch {
          /* non-blocking */
        }
      }
    }
    return;
  }

  await updateDoc(doc(db, COLLECTIONS.inductionAssignments, params.assignmentId), {
    status: params.passed ? "passed" : "failed",
    score: params.percentage,
    passed: params.passed,
    assessmentAttemptId: params.attemptId,
    completedAt: params.passed ? now : undefined,
    updatedAt: now,
    updatedBy: params.actorId,
  });

  if (params.passed) {
    try {
      const { completeInductionLifecycle } = await import("@/lib/services/lifecycle");
      await completeInductionLifecycle(params.employeeId, {
        uid: params.actorId,
        name: "Assessment Engine",
        role: "super_admin",
      });
    } catch {
      /* non-blocking */
    }
  }
}

/** Super Admin only — permanently remove an induction module. */
export async function deleteInductionModule(moduleId: string): Promise<void> {
  if (await preferLocal(moduleId)) {
    const store = readInductionStore();
    store.modules = store.modules.filter((m) => m.id !== moduleId);
    store.assignments = store.assignments.filter((a) => a.moduleId !== moduleId);
    writeInductionStore(store);
    return;
  }

  await deleteDoc(doc(db, COLLECTIONS.inductionModules, moduleId));
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.inductionAssignments), where("moduleId", "==", moduleId))
    );
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch {
    /* related cleanup best-effort */
  }
}

/** Super Admin only — remove a single induction assignment. */
export async function deleteInductionAssignment(assignmentId: string): Promise<void> {
  if (await preferLocal()) {
    const store = readInductionStore();
    store.assignments = store.assignments.filter((a) => a.id !== assignmentId);
    writeInductionStore(store);
    return;
  }

  await deleteDoc(doc(db, COLLECTIONS.inductionAssignments, assignmentId));
}
