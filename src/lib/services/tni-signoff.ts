import { auth } from "@/lib/firebase/client";
import { isDemoMode } from "@/lib/demo/data";
import { readTrainingStore } from "@/lib/training/demo-store";
import { readLifecycleStore } from "@/lib/lifecycle/demo-store";
import { acknowledgeTniSignoff } from "@/lib/services/training";
import {
  extraEmployeeIdsFromEmployees,
} from "@/lib/jd/absence-handover";
import {
  actorPendingTniSlots,
  isTniSignoffAssignee,
  parseTniSignoffSlot,
  TNI_SIGNOFF_SLOTS,
} from "@/lib/tni/signoff";
import type { TrainingNeedIdentification, TniSignoffSlot } from "@/types";

export interface TniPendingSignoffRow {
  tniId: string;
  slot: TniSignoffSlot;
  label: string;
  actionLabel: string;
  title: string;
  employeeId: string;
  createdAt: string;
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
  Promise<{ items: TrainingNeedIdentification[]; pending: TniPendingSignoffRow[] }>
>();

function pendingRows(
  items: TrainingNeedIdentification[],
  actor: { uid: string; employeeId?: string },
  extraEmployeeIds: string[] = []
): TniPendingSignoffRow[] {
  return items.flatMap((tni) =>
    actorPendingTniSlots(tni, actor, extraEmployeeIds).map((slot) => ({
      tniId: tni.id,
      slot,
      label: TNI_SIGNOFF_SLOTS[slot].label,
      actionLabel: TNI_SIGNOFF_SLOTS[slot].actionLabel,
      title: TNI_SIGNOFF_SLOTS[slot].label,
      employeeId: tni.employeeId,
      createdAt: tni.createdAt,
    }))
  );
}

async function fetchMyTniSignoffsUncached(actor: {
  uid: string;
  employeeId?: string;
}): Promise<{ items: TrainingNeedIdentification[]; pending: TniPendingSignoffRow[] }> {
  if (isDemoMode()) {
    const extraIds = extraEmployeeIdsFromEmployees(actor, readLifecycleStore().employees);
    const items = readTrainingStore()
      .tnis.filter((tni) => isTniSignoffAssignee(tni, actor, extraIds))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return { items, pending: pendingRows(items, actor, extraIds) };
  }

  const res = await fetch("/api/tni/signoff", { headers: await authHeaders() });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    items?: TrainingNeedIdentification[];
    pending?: TniPendingSignoffRow[];
  };
  if (!res.ok) {
    throw new Error(json.error || "Could not load assigned TNIs");
  }
  return { items: json.items || [], pending: json.pending || [] };
}

export async function fetchMyTniSignoffs(actor: {
  uid: string;
  employeeId?: string;
}): Promise<{ items: TrainingNeedIdentification[]; pending: TniPendingSignoffRow[] }> {
  const key = `${actor.uid}:${actor.employeeId || ""}`;
  const existing = inflightByActor.get(key);
  if (existing) return existing;
  const pending = fetchMyTniSignoffsUncached(actor).finally(() => {
    if (inflightByActor.get(key) === pending) inflightByActor.delete(key);
  });
  inflightByActor.set(key, pending);
  return pending;
}

export async function approveTniSignoffAssignment(
  tniId: string,
  actor: { uid: string; name: string; employeeId?: string },
  slot: TniSignoffSlot | string = "prepared_by"
): Promise<TrainingNeedIdentification> {
  const parsed = parseTniSignoffSlot(slot);
  if (isDemoMode()) {
    return acknowledgeTniSignoff(tniId, parsed, actor);
  }

  const res = await fetch(`/api/tni/signoff/${encodeURIComponent(tniId)}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ slot: parsed }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    tni?: TrainingNeedIdentification;
  };
  if (!res.ok || !json.tni) {
    throw new Error(json.error || "Approval failed");
  }
  return json.tni;
}
