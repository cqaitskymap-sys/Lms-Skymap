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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, COLLECTIONS } from "@/lib/firebase/client";
import type { InductionModule, InductionAssignment, InductionDocument } from "@/types";
import { generateId, nowISO } from "@/lib/services/helpers";

export async function createInductionModule(
  data: Omit<InductionModule, "id" | "createdAt" | "updatedAt" | "createdBy" | "documents">,
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
  await setDoc(doc(db, COLLECTIONS.inductionModules, id), inductionModule);
  return inductionModule;
}

export async function listInductionModules(): Promise<InductionModule[]> {
  const q = query(
    collection(db, COLLECTIONS.inductionModules),
    where("isActive", "==", true),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InductionModule);
}

export async function uploadInductionDocument(
  moduleId: string,
  file: File,
  title: string,
  actorId: string
): Promise<InductionDocument> {
  const docId = generateId("doc");
  const path = `induction/${moduleId}/${docId}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);

  const type =
    file.type.includes("pdf")
      ? "pdf"
      : file.type.includes("video")
        ? "video"
        : file.name.match(/\.pptx?$/i)
          ? "ppt"
          : "other";

  const document: InductionDocument = {
    id: docId,
    title,
    type,
    storagePath: path,
    downloadUrl,
    fileSize: file.size,
    mimeType: file.type,
    uploadedAt: nowISO(),
    uploadedBy: actorId,
  };

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
    await setDoc(doc(db, COLLECTIONS.inductionAssignments, id), assignment);
    assignments.push(assignment);
  }

  await updateDoc(doc(db, COLLECTIONS.employees, employeeId), {
    status: "induction",
    inductionStatus: "in_progress",
    updatedAt: now,
    updatedBy: actorId,
  });

  return assignments;
}

export async function getEmployeeInductionAssignments(
  employeeId: string
): Promise<InductionAssignment[]> {
  const q = query(
    collection(db, COLLECTIONS.inductionAssignments),
    where("employeeId", "==", employeeId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InductionAssignment);
}

export async function markDocumentViewed(
  assignmentId: string,
  documentId: string,
  actorId: string
): Promise<void> {
  const snap = await getDoc(doc(db, COLLECTIONS.inductionAssignments, assignmentId));
  if (!snap.exists()) return;
  const assignment = snap.data() as InductionAssignment;
  const viewed = Array.from(new Set([...assignment.documentsViewed, documentId]));
  const moduleSnap = await getDoc(doc(db, COLLECTIONS.inductionModules, assignment.moduleId));
  const inductionModule = moduleSnap.data() as InductionModule;
  const total = inductionModule.documents?.length || 1;
  const progress = Math.round((viewed.length / total) * 100);

  await updateDoc(doc(db, COLLECTIONS.inductionAssignments, assignmentId), {
    documentsViewed: viewed,
    progressPercent: progress,
    status: progress >= 100 ? "assessment_pending" : "in_progress",
    startedAt: assignment.startedAt || nowISO(),
    updatedAt: nowISO(),
    updatedBy: actorId,
  });
}
