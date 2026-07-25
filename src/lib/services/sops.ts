/**
 * SOP Management service — create, revise, approve, archive, views,
 * digital acknowledgement, and auto-retraining on revision.
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
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, COLLECTIONS } from "@/lib/firebase/client";
import type {
  SopAcknowledgement,
  SopAttachment,
  SopDocument,
  SopStatus,
  SopViewRecord,
  SopVersion,
  TrainingAssignment,
  UserRole,
} from "@/types";
import { generateId, nowISO, addDays } from "@/lib/services/helpers";
import { isDemoMode } from "@/lib/demo/data";
import {
  detectAttachmentType,
  fileToDemoUrl,
  readSopStore,
  writeSopStore,
} from "@/lib/sops/demo-store";
import { logActivity } from "@/lib/services/activity";

export interface SopActor {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
}

/** Prefer local demo store when demo mode is on, or SOP only exists locally. */
async function useLocalStore(sopId?: string): Promise<boolean> {
  if (isDemoMode()) return true;
  if (!sopId) return false;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.sops, sopId));
    if (snap.exists()) return false;
    return readSopStore().sops.some((s) => s.id === sopId);
  } catch {
    return true;
  }
}

async function uploadAttachment(
  sopId: string,
  versionLabel: string,
  file: File,
  actorId: string,
  title?: string
): Promise<SopAttachment> {
  const type = detectAttachmentType(file);
  const attId = generateId("att");

  if (isDemoMode()) {
    const url = await fileToDemoUrl(file);
    return {
      id: attId,
      type,
      title: title || file.name,
      fileName: file.name,
      storagePath: `demo/sops/${sopId}/${versionLabel}_${file.name}`,
      downloadUrl: url,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      uploadedAt: nowISO(),
      uploadedBy: actorId,
    };
  }

  const path = `sops/${sopId}/v${versionLabel}_${attId}_${file.name}`;
  await uploadBytes(ref(storage, path), file);
  const downloadUrl = await getDownloadURL(ref(storage, path));
  return {
    id: attId,
    type,
    title: title || file.name,
    fileName: file.name,
    storagePath: path,
    downloadUrl,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    uploadedAt: nowISO(),
    uploadedBy: actorId,
  };
}

function primaryPdf(attachments: SopAttachment[]) {
  return attachments.find((a) => a.type === "pdf") || attachments[0];
}

async function writeAuditClient(params: {
  actor: SopActor;
  action: string;
  resourceId: string;
  description: string;
}) {
  void logActivity({
    userId: params.actor.uid,
    verb: "lifecycle_advanced",
    summary: params.description,
    resourceType: "sop",
    resourceId: params.resourceId,
    metadata: { action: params.action },
  });

  if (isDemoMode()) return;
  try {
    const id = generateId("audit");
    await setDoc(doc(db, COLLECTIONS.auditLogs, id), {
      id,
      timestamp: nowISO(),
      actorId: params.actor.uid,
      actorEmail: params.actor.email,
      actorRole: params.actor.role,
      action: params.action,
      resourceType: "sop",
      resourceId: params.resourceId,
      description: params.description,
    });
  } catch {
    /* non-blocking */
  }
}

export async function listSopsDetailed(filters?: {
  status?: SopStatus | "";
  departmentId?: string;
  search?: string;
}): Promise<(SopDocument & { version?: SopVersion })[]> {
  const applyFilters = (list: (SopDocument & { version?: SopVersion })[]) => {
    let next = list;
    if (filters?.status) next = next.filter((s) => s.status === filters.status);
    if (filters?.departmentId) {
      next = next.filter((s) => s.departmentIds.includes(filters.departmentId!));
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      next = next.filter((s) =>
        `${s.sopNumber} ${s.title} ${s.category} ${s.tags.join(" ")}`
          .toLowerCase()
          .includes(q)
      );
    }
    return next;
  };

  if (isDemoMode()) {
    const store = readSopStore();
    return applyFilters(
      store.sops.map((s) => ({
        ...s,
        version: store.versions.find((v) => v.id === s.currentVersionId),
      }))
    );
  }

  try {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.sops), orderBy("sopNumber", "asc"))
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SopDocument);
    if (list.length === 0) {
      // Empty project — fall back to seeded demo store for UX
      const store = readSopStore();
      return applyFilters(
        store.sops.map((s) => ({
          ...s,
          version: store.versions.find((v) => v.id === s.currentVersionId),
        }))
      );
    }
    return applyFilters(list);
  } catch {
    const store = readSopStore();
    return applyFilters(
      store.sops.map((s) => ({
        ...s,
        version: store.versions.find((v) => v.id === s.currentVersionId),
      }))
    );
  }
}

export async function getSopBundle(sopId: string): Promise<{
  sop: SopDocument | null;
  versions: SopVersion[];
  currentVersion: SopVersion | null;
  views: SopViewRecord[];
  acknowledgements: SopAcknowledgement[];
}> {
  const fromStore = () => {
    const store = readSopStore();
    const sop = store.sops.find((s) => s.id === sopId) || null;
    const versions = store.versions
      .filter((v) => v.sopId === sopId)
      .sort((a, b) => b.major - a.major || b.minor - a.minor);
    return {
      sop,
      versions,
      currentVersion:
        versions.find((v) => v.id === sop?.currentVersionId) || versions[0] || null,
      views: store.views
        .filter((v) => v.sopId === sopId)
        .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt)),
      acknowledgements: store.acknowledgements
        .filter((a) => a.sopId === sopId)
        .sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt)),
    };
  };

  if (isDemoMode()) return fromStore();

  try {
    const sopSnap = await getDoc(doc(db, COLLECTIONS.sops, sopId));
    if (!sopSnap.exists()) {
      // May be a demo-seeded id
      return fromStore();
    }
    const sop = { id: sopSnap.id, ...sopSnap.data() } as SopDocument;

    const versionsSnap = await getDocs(
      query(
        collection(db, COLLECTIONS.sopVersions),
        where("sopId", "==", sopId),
        orderBy("major", "desc"),
        orderBy("minor", "desc")
      )
    );
    const versions = versionsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as SopVersion
    );

    const viewsSnap = await getDocs(
      query(
        collection(db, COLLECTIONS.sopViews),
        where("sopId", "==", sopId),
        orderBy("viewedAt", "desc"),
        limit(100)
      )
    );
    const ackSnap = await getDocs(
      query(
        collection(db, COLLECTIONS.sopAcknowledgements),
        where("sopId", "==", sopId),
        orderBy("acknowledgedAt", "desc"),
        limit(100)
      )
    );

    return {
      sop,
      versions,
      currentVersion: versions.find((v) => v.id === sop.currentVersionId) || null,
      views: viewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as SopViewRecord),
      acknowledgements: ackSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as SopAcknowledgement
      ),
    };
  } catch {
    return fromStore();
  }
}

export async function createSopWithFiles(
  data: {
    sopNumber: string;
    title: string;
    description: string;
    departmentIds: string[];
    category: string;
    tags: string[];
    changeSummary: string;
    effectiveDate?: string;
    reviewDate?: string;
    files: File[];
  },
  actor: SopActor
): Promise<{ sop: SopDocument; version: SopVersion }> {
  if (!data.files.length) throw new Error("Upload at least one file (PDF recommended)");

  const sopId = generateId("sop");
  const versionId = generateId("sopv");
  const now = nowISO();
  const attachments: SopAttachment[] = [];

  for (const file of data.files) {
    attachments.push(await uploadAttachment(sopId, "1.0", file, actor.uid));
  }

  const primary = primaryPdf(attachments)!;
  const version: SopVersion = {
    id: versionId,
    sopId,
    versionNumber: "1.0",
    major: 1,
    minor: 0,
    changeSummary: data.changeSummary || "Initial release",
    storagePath: primary.storagePath,
    downloadUrl: primary.downloadUrl,
    fileSize: primary.fileSize,
    mimeType: primary.mimeType,
    status: "draft",
    attachments,
    effectiveDate: data.effectiveDate,
    reviewDate: data.reviewDate || addDays(now, 365),
    viewCount: 0,
    acknowledgementCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  };

  const sop: SopDocument = {
    id: sopId,
    sopNumber: data.sopNumber.trim().toUpperCase(),
    title: data.title.trim(),
    description: data.description.trim(),
    departmentIds: data.departmentIds,
    category: data.category.trim(),
    currentVersionId: versionId,
    currentVersionNumber: "1.0",
    status: "draft",
    tags: data.tags,
    effectiveDate: data.effectiveDate,
    reviewDate: version.reviewDate,
    ownerUserId: actor.uid,
    viewCount: 0,
    acknowledgementCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  };

  if (isDemoMode()) {
    const store = readSopStore();
    store.sops.unshift(sop);
    store.versions.unshift(version);
    writeSopStore(store);
  } else {
    try {
      await setDoc(doc(db, COLLECTIONS.sops, sopId), sop);
      await setDoc(doc(db, COLLECTIONS.sopVersions, versionId), version);
    } catch {
      const store = readSopStore();
      store.sops.unshift(sop);
      store.versions.unshift(version);
      writeSopStore(store);
    }
  }

  await writeAuditClient({
    actor,
    action: "create",
    resourceId: sopId,
    description: `Created SOP ${sop.sopNumber} v1.0 as draft`,
  });

  return { sop, version };
}

export async function reviseSopWithFiles(
  sopId: string,
  params: {
    changeSummary: string;
    files: File[];
    majorBump?: boolean;
    effectiveDate?: string;
    reviewDate?: string;
  },
  actor: SopActor
): Promise<SopVersion> {
  const bundle = await getSopBundle(sopId);
  if (!bundle.sop || !bundle.currentVersion) throw new Error("SOP not found");

  const current = bundle.currentVersion;
  const major = params.majorBump ? current.major + 1 : current.major;
  const minor = params.majorBump ? 0 : current.minor + 1;
  const versionNumber = `${major}.${minor}`;
  const versionId = generateId("sopv");
  const now = nowISO();

  if (!params.files.length) throw new Error("Upload revision files");

  const attachments: SopAttachment[] = [];
  for (const file of params.files) {
    attachments.push(await uploadAttachment(sopId, versionNumber, file, actor.uid));
  }
  const primary = primaryPdf(attachments)!;

  // Archive / supersede previous current
  const superseded: Partial<SopVersion> = {
    status: "superseded",
    archivedAt: now,
    updatedAt: now,
    updatedBy: actor.uid,
  };

  const version: SopVersion = {
    id: versionId,
    sopId,
    versionNumber,
    major,
    minor,
    changeSummary: params.changeSummary,
    storagePath: primary.storagePath,
    downloadUrl: primary.downloadUrl,
    fileSize: primary.fileSize,
    mimeType: primary.mimeType,
    status: "draft",
    attachments,
    supersedesVersionId: current.id,
    effectiveDate: params.effectiveDate,
    reviewDate: params.reviewDate || addDays(now, 365),
    viewCount: 0,
    acknowledgementCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  };

  if (await useLocalStore(sopId)) {
    const store = readSopStore();
    store.versions = store.versions.map((v) =>
      v.id === current.id ? { ...v, ...superseded, status: "superseded" } : v
    );
    store.versions.unshift(version);
    store.sops = store.sops.map((s) =>
      s.id === sopId
        ? {
            ...s,
            currentVersionId: versionId,
            currentVersionNumber: versionNumber,
            status: "draft",
            updatedAt: now,
            updatedBy: actor.uid,
          }
        : s
    );
    writeSopStore(store);
  } else {
    await updateDoc(doc(db, COLLECTIONS.sopVersions, current.id), superseded);
    await setDoc(doc(db, COLLECTIONS.sopVersions, versionId), version);
    await updateDoc(doc(db, COLLECTIONS.sops, sopId), {
      currentVersionId: versionId,
      currentVersionNumber: versionNumber,
      status: "draft",
      updatedAt: now,
      updatedBy: actor.uid,
    });
  }

  await writeAuditClient({
    actor,
    action: "update",
    resourceId: sopId,
    description: `Uploaded revision ${versionNumber} for ${bundle.sop.sopNumber}`,
  });

  return version;
}

export async function submitSopForReview(
  sopId: string,
  versionId: string,
  actor: SopActor
): Promise<void> {
  const now = nowISO();
  if (await useLocalStore(sopId)) {
    const store = readSopStore();
    store.versions = store.versions.map((v) =>
      v.id === versionId
        ? {
            ...v,
            status: "under_review",
            submittedForReviewAt: now,
            submittedBy: actor.uid,
            updatedAt: now,
          }
        : v
    );
    store.sops = store.sops.map((s) =>
      s.id === sopId ? { ...s, status: "under_review", updatedAt: now } : s
    );
    writeSopStore(store);
  } else {
    await updateDoc(doc(db, COLLECTIONS.sopVersions, versionId), {
      status: "under_review",
      submittedForReviewAt: now,
      submittedBy: actor.uid,
      updatedAt: now,
      updatedBy: actor.uid,
    });
    await updateDoc(doc(db, COLLECTIONS.sops, sopId), {
      status: "under_review",
      updatedAt: now,
      updatedBy: actor.uid,
    });
  }

  await writeAuditClient({
    actor,
    action: "submit",
    resourceId: sopId,
    description: "Submitted SOP version for QA approval",
  });
}

export async function approveSopVersionFull(
  sopId: string,
  versionId: string,
  actor: SopActor,
  options?: { effectiveDate?: string; reviewDate?: string; triggerRetrain?: boolean }
): Promise<{ retrainCount: number }> {
  const now = nowISO();
  const effectiveDate = options?.effectiveDate || now;
  const reviewDate = options?.reviewDate || addDays(now, 365);

  let retrainCount = 0;

  if (await useLocalStore(sopId)) {
    const store = readSopStore();
    const version = store.versions.find((v) => v.id === versionId);
    const isRevision = Boolean(version?.supersedesVersionId);

    store.versions = store.versions.map((v) => {
      if (v.id === versionId) {
        return {
          ...v,
          status: "approved",
          approvedBy: actor.uid,
          approvedByName: actor.name,
          approvedAt: now,
          effectiveDate,
          reviewDate,
          updatedAt: now,
        };
      }
      if (v.sopId === sopId && v.id !== versionId && v.status === "approved") {
        return { ...v, status: "obsolete", archivedAt: now, updatedAt: now };
      }
      return v;
    });

    store.sops = store.sops.map((s) =>
      s.id === sopId
        ? {
            ...s,
            status: "approved",
            currentVersionId: versionId,
            currentVersionNumber: version?.versionNumber,
            effectiveDate,
            reviewDate,
            updatedAt: now,
          }
        : s
    );

    if (options?.triggerRetrain !== false && isRevision) {
      retrainCount = autoRetrainDemo(store, sopId, versionId, actor.uid);
    }
    writeSopStore(store);
  } else {
    const versionSnap = await getDoc(doc(db, COLLECTIONS.sopVersions, versionId));
    const version = versionSnap.data() as SopVersion;
    const isRevision = Boolean(version.supersedesVersionId);

    await updateDoc(doc(db, COLLECTIONS.sopVersions, versionId), {
      status: "approved",
      approvedBy: actor.uid,
      approvedByName: actor.name,
      approvedAt: now,
      effectiveDate,
      reviewDate,
      updatedAt: now,
      updatedBy: actor.uid,
    });

    // Archive other approved versions
    const others = await getDocs(
      query(
        collection(db, COLLECTIONS.sopVersions),
        where("sopId", "==", sopId),
        where("status", "==", "approved")
      )
    );
    for (const d of others.docs) {
      if (d.id === versionId) continue;
      await updateDoc(d.ref, {
        status: "obsolete",
        archivedAt: now,
        updatedAt: now,
        updatedBy: actor.uid,
      });
    }

    await updateDoc(doc(db, COLLECTIONS.sops, sopId), {
      status: "approved",
      currentVersionId: versionId,
      currentVersionNumber: version.versionNumber,
      effectiveDate,
      reviewDate,
      updatedAt: now,
      updatedBy: actor.uid,
    });

    if (options?.triggerRetrain !== false && isRevision) {
      retrainCount = await reassignTrainingOnRevision(sopId, versionId, actor.uid);
      await updateDoc(doc(db, COLLECTIONS.sopVersions, versionId), {
        retrainAssignedCount: retrainCount,
      });
    }
  }

  await writeAuditClient({
    actor,
    action: "approve",
    resourceId: sopId,
    description: `Approved SOP version — ${retrainCount} retraining assignment(s) created`,
  });

  return { retrainCount };
}

function autoRetrainDemo(
  store: ReturnType<typeof readSopStore>,
  sopId: string,
  newVersionId: string,
  actorId: string
): number {
  const prev = store.trainingAssignments.filter(
    (a) =>
      a.sopId === sopId &&
      ["passed", "training_completed", "assessment_pending"].includes(a.status)
  );
  const now = nowISO();
  let count = 0;
  for (const p of prev) {
    const id = generateId("ta");
    const assignment: TrainingAssignment = {
      id,
      employeeId: p.employeeId,
      sopId,
      sopVersionId: newVersionId,
      trainerId: p.trainerId,
      assignedBy: actorId,
      departmentId: p.departmentId,
      status: "assigned",
      attemptCount: 0,
      isRetraining: true,
      previousAssignmentId: p.id,
      triggeredBySopRevision: true,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
    };
    store.trainingAssignments.unshift(assignment);
    count++;
  }
  store.versions = store.versions.map((v) =>
    v.id === newVersionId ? { ...v, retrainAssignedCount: count } : v
  );
  return count;
}

export async function reassignTrainingOnRevision(
  sopId: string,
  newVersionId: string,
  actorId: string
): Promise<number> {
  if (isDemoMode()) {
    const store = readSopStore();
    const count = autoRetrainDemo(store, sopId, newVersionId, actorId);
    writeSopStore(store);
    return count;
  }

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
      trainerId: prev.trainerId,
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

    // Notify via notifications collection if user linked
    try {
      const empSnap = await getDoc(doc(db, COLLECTIONS.employees, prev.employeeId));
      const userId = empSnap.data()?.userId as string | undefined;
      if (userId) {
        const notifId = generateId("notif");
        await setDoc(doc(db, COLLECTIONS.notifications, notifId), {
          id: notifId,
          userId,
          type: "sop_revision",
          title: "SOP Revised — Retraining Required",
          message: "An SOP you were trained on has been revised. Complete updated training.",
          link: "/dashboard/training",
          isRead: false,
          createdAt: now,
          updatedAt: now,
          createdBy: actorId,
        });
      }
    } catch {
      /* ignore */
    }
    count++;
  }

  return count;
}

export async function archiveSopVersion(
  versionId: string,
  reason: string,
  actor: SopActor
): Promise<void> {
  const now = nowISO();
  const store = readSopStore();
  const found = store.versions.find((v) => v.id === versionId);
  const local = found ? await useLocalStore(found.sopId) : isDemoMode();

  if (local) {
    store.versions = store.versions.map((v) =>
      v.id === versionId
        ? {
            ...v,
            status: "obsolete",
            obsoleteReason: reason,
            archivedAt: now,
            updatedAt: now,
          }
        : v
    );
    writeSopStore(store);
  } else {
    await updateDoc(doc(db, COLLECTIONS.sopVersions, versionId), {
      status: "obsolete",
      obsoleteReason: reason,
      archivedAt: now,
      updatedAt: now,
      updatedBy: actor.uid,
    });
  }
  await writeAuditClient({
    actor,
    action: "update",
    resourceId: versionId,
    description: `Archived SOP version: ${reason}`,
  });
}

export async function recordSopView(params: {
  sopId: string;
  versionId: string;
  versionNumber: string;
  actor: SopActor;
  source: SopViewRecord["source"];
  durationSeconds?: number;
}): Promise<void> {
  const record: SopViewRecord = {
    id: generateId("view"),
    sopId: params.sopId,
    versionId: params.versionId,
    versionNumber: params.versionNumber,
    userId: params.actor.uid,
    userName: params.actor.name,
    userEmail: params.actor.email,
    employeeId: params.actor.employeeId,
    viewedAt: nowISO(),
    durationSeconds: params.durationSeconds,
    source: params.source,
  };

  if (isDemoMode() || (await useLocalStore(params.sopId))) {
    const store = readSopStore();
    store.views.unshift(record);
    store.versions = store.versions.map((v) =>
      v.id === params.versionId ? { ...v, viewCount: (v.viewCount || 0) + 1 } : v
    );
    store.sops = store.sops.map((s) =>
      s.id === params.sopId ? { ...s, viewCount: (s.viewCount || 0) + 1 } : s
    );
    writeSopStore(store);
    return;
  }

  try {
    await setDoc(doc(db, COLLECTIONS.sopViews, record.id), record);
    const vSnap = await getDoc(doc(db, COLLECTIONS.sopVersions, params.versionId));
    const count = ((vSnap.data()?.viewCount as number) || 0) + 1;
    await updateDoc(doc(db, COLLECTIONS.sopVersions, params.versionId), { viewCount: count });
    const sSnap = await getDoc(doc(db, COLLECTIONS.sops, params.sopId));
    await updateDoc(doc(db, COLLECTIONS.sops, params.sopId), {
      viewCount: ((sSnap.data()?.viewCount as number) || 0) + 1,
    });
  } catch {
    const store = readSopStore();
    store.views.unshift(record);
    writeSopStore(store);
  }
}

export async function acknowledgeSop(params: {
  sopId: string;
  versionId: string;
  versionNumber: string;
  actor: SopActor;
  signatureDataUrl?: string;
}): Promise<SopAcknowledgement> {
  const ack: SopAcknowledgement = {
    id: generateId("ack"),
    sopId: params.sopId,
    versionId: params.versionId,
    versionNumber: params.versionNumber,
    userId: params.actor.uid,
    userName: params.actor.name,
    userEmail: params.actor.email,
    employeeId: params.actor.employeeId,
    acknowledgedAt: nowISO(),
    statement:
      "I have read and understood this Standard Operating Procedure and agree to comply with its requirements in my role.",
    signatureDataUrl: params.signatureDataUrl,
  };

  if (isDemoMode() || (await useLocalStore(params.sopId))) {
    const store = readSopStore();
    const exists = store.acknowledgements.some(
      (a) => a.versionId === params.versionId && a.userId === params.actor.uid
    );
    if (exists) throw new Error("You have already acknowledged this version");
    store.acknowledgements.unshift(ack);
    store.versions = store.versions.map((v) =>
      v.id === params.versionId
        ? { ...v, acknowledgementCount: (v.acknowledgementCount || 0) + 1 }
        : v
    );
    store.sops = store.sops.map((s) =>
      s.id === params.sopId
        ? { ...s, acknowledgementCount: (s.acknowledgementCount || 0) + 1 }
        : s
    );
    writeSopStore(store);
  } else {
    await setDoc(doc(db, COLLECTIONS.sopAcknowledgements, ack.id), ack);
    const vSnap = await getDoc(doc(db, COLLECTIONS.sopVersions, params.versionId));
    await updateDoc(doc(db, COLLECTIONS.sopVersions, params.versionId), {
      acknowledgementCount: ((vSnap.data()?.acknowledgementCount as number) || 0) + 1,
    });
  }

  await recordSopView({
    sopId: params.sopId,
    versionId: params.versionId,
    versionNumber: params.versionNumber,
    actor: params.actor,
    source: "acknowledge",
  });

  await writeAuditClient({
    actor: params.actor,
    action: "sign",
    resourceId: params.sopId,
    description: `Digitally acknowledged SOP version ${params.versionNumber}`,
  });

  return ack;
}

/** Keep legacy exports used elsewhere */
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
) {
  return createSopWithFiles(
    {
      ...data,
      files: [data.file],
    },
    {
      uid: actorId,
      name: "User",
      email: "",
      role: "qa",
    }
  );
}

export async function reviseSop(
  sopId: string,
  params: { changeSummary: string; file: File; majorBump?: boolean },
  actorId: string
) {
  return reviseSopWithFiles(
    sopId,
    { ...params, files: [params.file] },
    { uid: actorId, name: "User", email: "", role: "qa" }
  );
}

export async function approveSopVersion(sopId: string, versionId: string, actorId: string) {
  return approveSopVersionFull(sopId, versionId, {
    uid: actorId,
    name: "Approver",
    email: "",
    role: "qa",
  });
}

export async function listSops(departmentId?: string) {
  const rows = await listSopsDetailed({ departmentId });
  return rows;
}

export async function getSopVersions(sopId: string) {
  const bundle = await getSopBundle(sopId);
  return bundle.versions;
}

export async function getSop(id: string) {
  const bundle = await getSopBundle(id);
  return bundle.sop;
}

/** Super Admin only — deletes SOP and related versions / views / acks. */
export async function deleteSop(sopId: string): Promise<void> {
  if (await useLocalStore(sopId)) {
    const store = readSopStore();
    store.sops = store.sops.filter((s) => s.id !== sopId);
    store.versions = store.versions.filter((v) => v.sopId !== sopId);
    store.views = store.views.filter((v) => v.sopId !== sopId);
    store.acknowledgements = store.acknowledgements.filter((a) => a.sopId !== sopId);
    store.trainingAssignments = store.trainingAssignments.filter((a) => a.sopId !== sopId);
    writeSopStore(store);
    return;
  }

  await deleteDoc(doc(db, COLLECTIONS.sops, sopId));
  try {
    const [versions, views, acks] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.sopVersions), where("sopId", "==", sopId))),
      getDocs(query(collection(db, COLLECTIONS.sopViews), where("sopId", "==", sopId))),
      getDocs(
        query(collection(db, COLLECTIONS.sopAcknowledgements), where("sopId", "==", sopId))
      ),
    ]);
    await Promise.all([
      ...versions.docs.map((d) => deleteDoc(d.ref)),
      ...views.docs.map((d) => deleteDoc(d.ref)),
      ...acks.docs.map((d) => deleteDoc(d.ref)),
    ]);
  } catch {
    /* related cleanup best-effort */
  }
}
