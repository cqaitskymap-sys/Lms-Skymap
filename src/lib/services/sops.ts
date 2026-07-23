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
import type { SopDocument, SopVersion, TrainingAssignment } from "@/types";
import { generateId, nowISO } from "@/lib/services/helpers";

export async function createSop(
  data: {
    sopNumber: string;
    title: string;
    description: string;
    departmentIds: string[];
    category: string;
    tags: string[];
    ownerUserId: string;
    changeSummary: string;
    file: File;
  },
  actorId: string
): Promise<{ sop: SopDocument; version: SopVersion }> {
  const sopId = generateId("sop");
  const versionId = generateId("sopv");
  const now = nowISO();

  const path = `sops/${sopId}/v1.0_${data.file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, data.file);
  const downloadUrl = await getDownloadURL(storageRef);

  const version: SopVersion = {
    id: versionId,
    sopId,
    versionNumber: "1.0",
    major: 1,
    minor: 0,
    changeSummary: data.changeSummary || "Initial release",
    storagePath: path,
    downloadUrl,
    fileSize: data.file.size,
    mimeType: data.file.type,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  const sop: SopDocument = {
    id: sopId,
    sopNumber: data.sopNumber,
    title: data.title,
    description: data.description,
    departmentIds: data.departmentIds,
    category: data.category,
    currentVersionId: versionId,
    status: "draft",
    tags: data.tags,
    ownerUserId: data.ownerUserId,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  await setDoc(doc(db, COLLECTIONS.sops, sopId), sop);
  await setDoc(doc(db, COLLECTIONS.sopVersions, versionId), version);

  return { sop, version };
}

export async function reviseSop(
  sopId: string,
  params: {
    changeSummary: string;
    file: File;
    majorBump?: boolean;
  },
  actorId: string
): Promise<SopVersion> {
  const sopSnap = await getDoc(doc(db, COLLECTIONS.sops, sopId));
  if (!sopSnap.exists()) throw new Error("SOP not found");
  const sop = sopSnap.data() as SopDocument;

  const currentVersionSnap = await getDoc(
    doc(db, COLLECTIONS.sopVersions, sop.currentVersionId)
  );
  const current = currentVersionSnap.data() as SopVersion;

  const major = params.majorBump ? current.major + 1 : current.major;
  const minor = params.majorBump ? 0 : current.minor + 1;
  const versionNumber = `${major}.${minor}`;
  const versionId = generateId("sopv");
  const now = nowISO();

  const path = `sops/${sopId}/v${versionNumber}_${params.file.name}`;
  await uploadBytes(ref(storage, path), params.file);
  const downloadUrl = await getDownloadURL(ref(storage, path));

  // Obsolete previous version
  await updateDoc(doc(db, COLLECTIONS.sopVersions, current.id), {
    status: "superseded",
    updatedAt: now,
    updatedBy: actorId,
  });

  const version: SopVersion = {
    id: versionId,
    sopId,
    versionNumber,
    major,
    minor,
    changeSummary: params.changeSummary,
    storagePath: path,
    downloadUrl,
    fileSize: params.file.size,
    mimeType: params.file.type,
    status: "draft",
    supersedesVersionId: current.id,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  await setDoc(doc(db, COLLECTIONS.sopVersions, versionId), version);
  await updateDoc(doc(db, COLLECTIONS.sops, sopId), {
    currentVersionId: versionId,
    status: "draft",
    updatedAt: now,
    updatedBy: actorId,
  });

  return version;
}

export async function approveSopVersion(
  sopId: string,
  versionId: string,
  actorId: string
): Promise<void> {
  const now = nowISO();
  await updateDoc(doc(db, COLLECTIONS.sopVersions, versionId), {
    status: "approved",
    approvedBy: actorId,
    approvedAt: now,
    updatedAt: now,
    updatedBy: actorId,
  });
  await updateDoc(doc(db, COLLECTIONS.sops, sopId), {
    status: "approved",
    effectiveDate: now,
    updatedAt: now,
    updatedBy: actorId,
  });
}

/**
 * On SOP revision approval — reassign training to all previously trained employees.
 * Called from Cloud Function; also available client-side for demos.
 */
export async function reassignTrainingOnRevision(
  sopId: string,
  newVersionId: string,
  actorId: string
): Promise<number> {
  const q = query(
    collection(db, COLLECTIONS.trainingAssignments),
    where("sopId", "==", sopId),
    where("status", "in", ["passed", "training_completed", "assessment_pending"])
  );
  const snap = await getDocs(q);
  const now = nowISO();
  let count = 0;

  for (const d of snap.docs) {
    const prev = d.data() as TrainingAssignment;
    const id = generateId("ta");
    const assignment: TrainingAssignment = {
      id,
      employeeId: prev.employeeId,
      sopId,
      sopVersionId: newVersionId,
      assignedBy: actorId,
      departmentId: prev.departmentId,
      status: "assigned",
      attemptCount: 0,
      isRetraining: true,
      previousAssignmentId: prev.id,
      triggeredBySopRevision: true,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
    };
    await setDoc(doc(db, COLLECTIONS.trainingAssignments, id), assignment);
    count++;
  }

  return count;
}

export async function listSops(departmentId?: string): Promise<SopDocument[]> {
  let q;
  if (departmentId) {
    q = query(
      collection(db, COLLECTIONS.sops),
      where("departmentIds", "array-contains", departmentId),
      orderBy("sopNumber", "asc")
    );
  } else {
    q = query(collection(db, COLLECTIONS.sops), orderBy("sopNumber", "asc"));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SopDocument);
}

export async function getSopVersions(sopId: string): Promise<SopVersion[]> {
  const q = query(
    collection(db, COLLECTIONS.sopVersions),
    where("sopId", "==", sopId),
    orderBy("major", "desc"),
    orderBy("minor", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SopVersion);
}

export async function getSop(id: string): Promise<SopDocument | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.sops, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SopDocument;
}
