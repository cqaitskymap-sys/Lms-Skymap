import type { JdSignoff, TrainingNeedIdentification, TniSignoffSlot } from "@/types";
import { isJdSignoffParty } from "@/lib/jd/absence-handover";

export const TNI_SIGNOFF_SLOTS: Record<
  TniSignoffSlot,
  { label: string; actionLabel: string; kind: string; roleLine: string }
> = {
  prepared_by: {
    label: "Prepared By",
    actionLabel: "Approve",
    kind: "tni_prepared_by",
    roleLine: "Department Training Coordinator/HOD",
  },
  approved_by: {
    label: "Approved By",
    actionLabel: "Approve",
    kind: "tni_approved_by",
    roleLine: "Head-Quality Assurance/Designee",
  },
};

export const TNI_QA_BEFORE_HOD_MESSAGE =
  "Head-Quality Assurance/Designee can approve only after Department Training Coordinator/HOD has approved.";

export function parseTniSignoffSlot(value: string | null | undefined): TniSignoffSlot {
  return value === "approved_by" ? "approved_by" : "prepared_by";
}

/** Prepared By (Department Training Coordinator/HOD) must sign before Approved By. */
export function isTniPreparedAcknowledged(
  tni: Pick<TrainingNeedIdentification, "preparedBySignoff">
): boolean {
  return tni.preparedBySignoff?.status === "acknowledged";
}

export function tniQaApprovalBlockReason(
  tni: Pick<TrainingNeedIdentification, "preparedBySignoff">,
  slot: TniSignoffSlot
): string | null {
  if (slot !== "approved_by") return null;
  if (isTniPreparedAcknowledged(tni)) return null;
  return TNI_QA_BEFORE_HOD_MESSAGE;
}

export function getTniSignoff(
  tni: TrainingNeedIdentification,
  slot: TniSignoffSlot
): JdSignoff | undefined {
  return slot === "approved_by" ? tni.approvedBySignoff : tni.preparedBySignoff;
}

export function isTniSignoffPending(
  tni: TrainingNeedIdentification,
  slot: TniSignoffSlot
): boolean {
  const signoff = getTniSignoff(tni, slot);
  if (!signoff) return false;
  if (!signoff.employeeId && !signoff.userId) return false;
  return signoff.status !== "acknowledged";
}

export function isTniSignoffAssignee(
  tni: Pick<TrainingNeedIdentification, "preparedBySignoff" | "approvedBySignoff">,
  actor: { uid: string; employeeId?: string },
  extraEmployeeIds: string[] = []
): boolean {
  return (
    isJdSignoffParty(tni.preparedBySignoff, actor, extraEmployeeIds) ||
    isJdSignoffParty(tni.approvedBySignoff, actor, extraEmployeeIds)
  );
}

export function actorPendingTniSlots(
  tni: TrainingNeedIdentification,
  actor: { uid: string; employeeId?: string },
  extraEmployeeIds: string[] = []
): TniSignoffSlot[] {
  const slots: TniSignoffSlot[] = [];
  if (
    isJdSignoffParty(tni.preparedBySignoff, actor, extraEmployeeIds) &&
    isTniSignoffPending(tni, "prepared_by")
  ) {
    slots.push("prepared_by");
  }
  if (
    isJdSignoffParty(tni.approvedBySignoff, actor, extraEmployeeIds) &&
    isTniSignoffPending(tni, "approved_by") &&
    isTniPreparedAcknowledged(tni)
  ) {
    slots.push("approved_by");
  }
  return slots;
}
