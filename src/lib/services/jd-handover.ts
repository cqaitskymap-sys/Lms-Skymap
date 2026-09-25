import { auth } from "@/lib/firebase/client";
import { isDemoMode } from "@/lib/demo/data";
import { readTrainingStore } from "@/lib/training/demo-store";
import { readLifecycleStore } from "@/lib/lifecycle/demo-store";
import { acknowledgeJdSignoff } from "@/lib/services/training";
import {
  actorPendingSlots,
  extraEmployeeIdsFromEmployees,
  isJdHandoverAssignee,
  JD_SIGNOFF_SLOTS,
  parseJdSignoffSlot,
} from "@/lib/jd/absence-handover";
import type { JobDescription, JdSignoffSlot } from "@/types";

export interface JdPendingSignoffRow {
  jdId: string;
  slot: JdSignoffSlot;
  label: string;
  actionLabel: string;
  title: string;
  jdNo: string;
  effectiveFrom: string;
}

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in");
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

const inflightByActor = new Map<
  string,
  Promise<{ items: JobDescription[]; pending: JdPendingSignoffRow[] }>
>();

function pendingRows(
  items: JobDescription[],
  actor: { uid: string; employeeId?: string },
  extraEmployeeIds: string[] = []
): JdPendingSignoffRow[] {
  return items.flatMap((jd) =>
    actorPendingSlots(jd, actor, extraEmployeeIds).map((slot) => ({
      jdId: jd.id,
      slot,
      label: JD_SIGNOFF_SLOTS[slot].label,
      actionLabel: JD_SIGNOFF_SLOTS[slot].actionLabel,
      title: jd.title,
      jdNo: jd.jdNo || jd.id,
      effectiveFrom: jd.effectiveFrom,
    }))
  );
}

async function fetchMyJdSignoffsUncached(actor: {
  uid: string;
  employeeId?: string;
}): Promise<{ items: JobDescription[]; pending: JdPendingSignoffRow[] }> {
  if (isDemoMode()) {
    const extraIds = extraEmployeeIdsFromEmployees(actor, readLifecycleStore().employees);
    const items = readTrainingStore()
      .jobDescriptions.filter((jd) => isJdHandoverAssignee(jd, actor, extraIds))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return { items, pending: pendingRows(items, actor, extraIds) };
  }

  const res = await fetch("/api/jd/absence-handover", { headers: await authHeaders() });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    items?: JobDescription[];
    pending?: JdPendingSignoffRow[];
  };
  if (!res.ok) {
    throw new Error(json.error || "Could not load assigned Job Descriptions");
  }
  return { items: json.items || [], pending: json.pending || [] };
}

export async function fetchMyJdSignoffs(actor: {
  uid: string;
  employeeId?: string;
}): Promise<{ items: JobDescription[]; pending: JdPendingSignoffRow[] }> {
  const key = `${actor.uid}:${actor.employeeId || ""}`;
  const existing = inflightByActor.get(key);
  if (existing) return existing;
  const pending = fetchMyJdSignoffsUncached(actor).finally(() => {
    if (inflightByActor.get(key) === pending) inflightByActor.delete(key);
  });
  inflightByActor.set(key, pending);
  return pending;
}

export async function approveJdHandoverAssignment(
  jdId: string,
  actor: { uid: string; name: string; employeeId?: string },
  slot: JdSignoffSlot | string = "absence_handover"
): Promise<JobDescription> {
  const parsed = parseJdSignoffSlot(slot);
  if (isDemoMode()) {
    return acknowledgeJdSignoff(jdId, parsed, actor);
  }

  const res = await fetch(`/api/jd/absence-handover/${encodeURIComponent(jdId)}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ slot: parsed }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    jd?: JobDescription;
  };
  if (!res.ok || !json.jd) {
    throw new Error(json.error || "Approval failed");
  }
  return json.jd;
}
