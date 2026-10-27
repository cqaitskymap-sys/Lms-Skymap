import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { JobDescription, JdSignoff, JdSignoffSlot } from "@/types";
import { FieldValue } from "firebase-admin/firestore";
import {
  absenceHandoverWriteFields,
  acknowledgeAbsenceParty,
  buildJdComputerGeneratedSignature,
  compactJdSignoff,
  getJdSignoff,
  isJdSignoffParty,
  isJdSignoffPending,
  parseJdSignoffSlot,
} from "@/lib/jd/absence-handover";

export async function employeeIdsForAuthUser(
  uid: string,
  profileEmployeeId?: string
): Promise<string[]> {
  const ids = new Set<string>();
  if (profileEmployeeId) ids.add(profileEmployeeId);
  if (!uid) return [...ids];
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.employees)
      .where("userId", "==", uid)
      .get();
    for (const doc of snap.docs) ids.add(doc.id);
  } catch (err) {
    console.warn("[jd] employee lookup by userId failed", err);
  }
  return [...ids];
}

function asJd(id: string, data: Record<string, unknown>): JobDescription {
  return { id, ...data } as JobDescription;
}

async function collectByField(field: string, value: string): Promise<JobDescription[]> {
  if (!value) return [];
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.jobDescriptions)
      .where(field, "==", value)
      .get();
    return snap.docs.map((d) => asJd(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    console.warn(`[jd] query ${field} failed`, err);
    return [];
  }
}

async function collectByArrayContains(field: string, value: string): Promise<JobDescription[]> {
  if (!value) return [];
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.jobDescriptions)
      .where(field, "array-contains", value)
      .get();
    return snap.docs.map((d) => asJd(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    console.warn(`[jd] query ${field} array-contains failed`, err);
    return [];
  }
}

export async function listAbsenceHandoverJdsForUser(actor: {
  uid: string;
  employeeId?: string;
}): Promise<{ items: JobDescription[]; extraEmployeeIds: string[] }> {
  const extraPromise = employeeIdsForAuthUser(actor.uid, actor.employeeId);
  const uidPromise = Promise.all([
    collectByField("absenceHandoverUserId", actor.uid),
    collectByArrayContains("absenceHandoverUserIds", actor.uid),
    collectByField("assignedBy.userId", actor.uid),
    collectByField("acceptedBy.userId", actor.uid),
  ]);
  const extraEmployeeIds = await extraPromise;
  const empPromise = Promise.all(
    extraEmployeeIds.flatMap((empId) => [
      collectByField("absenceHandoverEmployeeId", empId),
      collectByArrayContains("absenceHandoverEmployeeIds", empId),
      collectByField("assignedBy.employeeId", empId),
      collectByField("acceptedBy.employeeId", empId),
    ])
  );
  const [uidChunks, empChunks] = await Promise.all([uidPromise, empPromise]);

  const byId = new Map<string, JobDescription>();
  for (const rows of [...uidChunks, ...empChunks]) {
    for (const row of rows) byId.set(row.id, row);
  }

  const items = [...byId.values()].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );
  return { items, extraEmployeeIds };
}

function applyNestedAck(
  slot: "assigned_by" | "accepted_by",
  existing: JdSignoff,
  name: string,
  now: string,
  actorUid: string
): Record<string, unknown> {
  const next = compactJdSignoff({
    ...existing,
    status: "acknowledged",
    acknowledgedAt: now,
    acknowledgedBy: actorUid,
    acknowledgedByName: name,
    signatureText: buildJdComputerGeneratedSignature(name, now),
  });
  const key = slot === "assigned_by" ? "assignedBy" : "acceptedBy";
  return {
    [key]: next,
    updatedAt: now,
    updatedBy: actorUid,
  };
}

export async function acknowledgeJdSignoffForUser(
  jdId: string,
  slotInput: string | null | undefined,
  actor: { uid: string; name: string; employeeId?: string }
): Promise<JobDescription> {
  const slot: JdSignoffSlot = parseJdSignoffSlot(slotInput);
  const ref = adminDb.collection(COLLECTIONS.jobDescriptions).doc(jdId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Job Description not found");

  const jd = asJd(snap.id, (snap.data() || {}) as Record<string, unknown>);
  const extraIds = await employeeIdsForAuthUser(actor.uid, actor.employeeId);
  const now = new Date().toISOString();

  if (slot === "absence_handover") {
    const parties = acknowledgeAbsenceParty(jd, actor, extraIds, now);
    const fields = absenceHandoverWriteFields(parties);
    const patch: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: actor.uid,
    };
    for (const [key, value] of Object.entries(fields)) {
      patch[key] = value === undefined ? FieldValue.delete() : value;
    }
    await ref.update(patch);
    const next: JobDescription = { ...jd, updatedAt: now, updatedBy: actor.uid };
    const record = next as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) delete record[key];
      else record[key] = value;
    }
    return next;
  }

  const signoff = getJdSignoff(jd, slot);
  if (!signoff || (!signoff.employeeId && !signoff.userId)) {
    throw new Error("This Job Description has no person named for that signature");
  }
  if (!isJdSignoffParty(signoff, actor, extraIds)) {
    throw new Error("Only the named person can approve this signature");
  }
  if (!isJdSignoffPending(jd, slot)) {
    throw new Error("This signature is already approved");
  }
  const name = (actor.name || signoff.name || "Assignee").trim();
  const patch = applyNestedAck(slot, signoff, name, now, actor.uid);

  await ref.update(patch);
  return { ...jd, ...patch } as JobDescription;
}

export async function acknowledgeAbsenceHandoverForUser(
  jdId: string,
  actor: { uid: string; name: string; employeeId?: string }
): Promise<JobDescription> {
  return acknowledgeJdSignoffForUser(jdId, "absence_handover", actor);
}
