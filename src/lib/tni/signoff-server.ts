import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { JdSignoff, TrainingNeedIdentification, TniSignoffSlot } from "@/types";
import { employeeIdsForAuthUser } from "@/lib/jd/absence-handover-server";
import {
  buildJdComputerGeneratedSignature,
  compactJdSignoff,
  isJdSignoffParty,
} from "@/lib/jd/absence-handover";
import { getTniSignoff, isTniSignoffPending, parseTniSignoffSlot } from "@/lib/tni/signoff";

function asTni(id: string, data: Record<string, unknown>): TrainingNeedIdentification {
  return { id, ...data } as TrainingNeedIdentification;
}

async function collectByField(field: string, value: string): Promise<TrainingNeedIdentification[]> {
  if (!value) return [];
  try {
    const snap = await adminDb.collection(COLLECTIONS.tni).where(field, "==", value).get();
    return snap.docs.map((d) => asTni(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    console.warn(`[tni] query ${field} failed`, err);
    return [];
  }
}

export async function listTniSignoffsForUser(actor: {
  uid: string;
  employeeId?: string;
}): Promise<{ items: TrainingNeedIdentification[]; extraEmployeeIds: string[] }> {
  const extraPromise = employeeIdsForAuthUser(actor.uid, actor.employeeId);
  const uidPromise = Promise.all([
    collectByField("preparedBySignoff.userId", actor.uid),
    collectByField("approvedBySignoff.userId", actor.uid),
  ]);
  const extraEmployeeIds = await extraPromise;
  const empPromise = Promise.all(
    extraEmployeeIds.flatMap((empId) => [
      collectByField("preparedBySignoff.employeeId", empId),
      collectByField("approvedBySignoff.employeeId", empId),
    ])
  );
  const [uidChunks, empChunks] = await Promise.all([uidPromise, empPromise]);

  const byId = new Map<string, TrainingNeedIdentification>();
  for (const rows of [...uidChunks, ...empChunks]) {
    for (const row of rows) byId.set(row.id, row);
  }

  const items = [...byId.values()].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );
  return { items, extraEmployeeIds };
}

export async function acknowledgeTniSignoffForUser(
  tniId: string,
  slotInput: string | null | undefined,
  actor: { uid: string; name: string; employeeId?: string }
): Promise<TrainingNeedIdentification> {
  const slot: TniSignoffSlot = parseTniSignoffSlot(slotInput);
  const ref = adminDb.collection(COLLECTIONS.tni).doc(tniId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("TNI not found");

  const tni = asTni(snap.id, (snap.data() || {}) as Record<string, unknown>);
  const extraIds = await employeeIdsForAuthUser(actor.uid, actor.employeeId);
  const existing = getTniSignoff(tni, slot);
  if (!existing || (!existing.employeeId && !existing.userId)) {
    throw new Error("This TNI has no person named for that signature");
  }
  if (!isJdSignoffParty(existing, actor, extraIds)) {
    throw new Error("Only the named person can approve this signature");
  }
  if (!isTniSignoffPending(tni, slot)) {
    throw new Error("This signature is already approved");
  }

  const now = new Date().toISOString();
  const name = (actor.name || existing.name || "Assignee").trim();
  const next: JdSignoff = compactJdSignoff({
    ...existing,
    status: "acknowledged",
    acknowledgedAt: now,
    acknowledgedBy: actor.uid,
    acknowledgedByName: name,
    signatureText: buildJdComputerGeneratedSignature(name, now),
  });
  const key = slot === "approved_by" ? "approvedBySignoff" : "preparedBySignoff";
  const patch: Record<string, unknown> = {
    [key]: next,
    updatedAt: now,
    updatedBy: actor.uid,
  };
  if (slot === "approved_by" && tni.status === "submitted") {
    patch.status = "approved";
    patch.approvedBy = actor.uid;
    patch.approvedAt = now;
  }

  await ref.update(patch);
  return { ...tni, ...patch } as TrainingNeedIdentification;
}
