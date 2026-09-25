import type { JobDescription, JdSignoff, JdSignoffSlot } from "@/types";

export function formatJdSignatureStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildJdComputerGeneratedSignature(name: string, at: string): string {
  return `${name} · Electronically computer-generated · ${formatJdSignatureStamp(at)}`;
}

export const JD_SIGNOFF_SLOTS: Record<
  JdSignoffSlot,
  { label: string; actionLabel: string; kind: string }
> = {
  absence_handover: {
    label: "Absence handover",
    actionLabel: "Approve",
    kind: "jd_absence_handover",
  },
  assigned_by: {
    label: "Job Responsibility Assigned by",
    actionLabel: "Approve",
    kind: "jd_assigned_by",
  },
  accepted_by: {
    label: "Job Responsibility Accepted by",
    actionLabel: "Accept",
    kind: "jd_accepted_by",
  },
};

export function isJdSignoffParty(
  signoff: JdSignoff | undefined,
  actor: { uid: string; employeeId?: string },
  extraEmployeeIds: string[] = []
): boolean {
  if (!signoff) return false;
  if (signoff.userId && signoff.userId === actor.uid) return true;
  const ids = new Set(extraEmployeeIds.filter(Boolean));
  if (actor.employeeId) ids.add(actor.employeeId);
  if (signoff.employeeId && ids.has(signoff.employeeId)) return true;
  return false;
}

export function isJdHandoverAssignee(
  jd: Pick<JobDescription, "absenceHandoverUserId" | "absenceHandoverEmployeeId" | "assignedBy" | "acceptedBy">,
  actor: { uid: string; employeeId?: string },
  extraEmployeeIds: string[] = []
): boolean {
  if (jd.absenceHandoverUserId && jd.absenceHandoverUserId === actor.uid) return true;
  const ids = new Set(extraEmployeeIds.filter(Boolean));
  if (actor.employeeId) ids.add(actor.employeeId);
  if (jd.absenceHandoverEmployeeId && ids.has(jd.absenceHandoverEmployeeId)) return true;
  if (isJdSignoffParty(jd.assignedBy, actor, extraEmployeeIds)) return true;
  if (isJdSignoffParty(jd.acceptedBy, actor, extraEmployeeIds)) return true;
  return false;
}

export function isJdHandoverPending(jd: Pick<JobDescription, "absenceHandoverStatus">): boolean {
  return jd.absenceHandoverStatus !== "acknowledged";
}

export function signoffFromLegacyAbsence(jd: JobDescription): JdSignoff | undefined {
  if (!jd.absenceHandoverEmployeeId && !jd.absenceHandoverUserId) return undefined;
  return {
    employeeId: jd.absenceHandoverEmployeeId,
    userId: jd.absenceHandoverUserId,
    name: jd.absenceHandoverName,
    status: jd.absenceHandoverStatus,
    acknowledgedAt: jd.absenceHandoverAcknowledgedAt,
    acknowledgedBy: jd.absenceHandoverAcknowledgedBy,
    acknowledgedByName: jd.absenceHandoverAcknowledgedByName,
    signatureText: jd.absenceHandoverSignatureText,
  };
}

export function getJdSignoff(jd: JobDescription, slot: JdSignoffSlot): JdSignoff | undefined {
  if (slot === "assigned_by") return jd.assignedBy;
  if (slot === "accepted_by") return jd.acceptedBy;
  return signoffFromLegacyAbsence(jd);
}

export function isJdSignoffPending(jd: JobDescription, slot: JdSignoffSlot): boolean {
  const signoff = getJdSignoff(jd, slot);
  if (!signoff) return false;
  if (!signoff.employeeId && !signoff.userId) return false;
  return signoff.status !== "acknowledged";
}

export function actorPendingSlots(
  jd: JobDescription,
  actor: { uid: string; employeeId?: string },
  extraEmployeeIds: string[] = []
): JdSignoffSlot[] {
  const slots: JdSignoffSlot[] = [];
  if (
    isJdSignoffParty(signoffFromLegacyAbsence(jd), actor, extraEmployeeIds) &&
    isJdSignoffPending(jd, "absence_handover")
  ) {
    slots.push("absence_handover");
  }
  if (isJdSignoffParty(jd.assignedBy, actor, extraEmployeeIds) && isJdSignoffPending(jd, "assigned_by")) {
    slots.push("assigned_by");
  }
  if (isJdSignoffParty(jd.acceptedBy, actor, extraEmployeeIds) && isJdSignoffPending(jd, "accepted_by")) {
    slots.push("accepted_by");
  }
  return slots;
}

export function parseJdSignoffSlot(value: string | null | undefined): JdSignoffSlot {
  if (value === "assigned_by" || value === "accepted_by" || value === "absence_handover") {
    return value;
  }
  return "absence_handover";
}

/** Drop empty/undefined fields so Firestore updateDoc does not reject nested maps. */
export function compactJdSignoff(signoff: JdSignoff): JdSignoff {
  const out: JdSignoff = { status: signoff.status || "pending" };
  if (signoff.employeeId) out.employeeId = signoff.employeeId;
  if (signoff.userId) out.userId = signoff.userId;
  if (signoff.name) out.name = signoff.name;
  if (signoff.designation) out.designation = signoff.designation;
  if (signoff.acknowledgedAt) out.acknowledgedAt = signoff.acknowledgedAt;
  if (signoff.acknowledgedBy) out.acknowledgedBy = signoff.acknowledgedBy;
  if (signoff.acknowledgedByName) out.acknowledgedByName = signoff.acknowledgedByName;
  if (signoff.signatureText) out.signatureText = signoff.signatureText;
  return out;
}

export function sameJdSignoffPerson(a?: JdSignoff, b?: JdSignoff): boolean {
  if (!a || !b) return false;
  if (a.userId && b.userId && a.userId === b.userId) return true;
  if (a.employeeId && b.employeeId && a.employeeId === b.employeeId) return true;
  return false;
}

export function extraEmployeeIdsFromEmployees(
  actor: { uid: string; employeeId?: string },
  employees: { id: string; userId?: string }[]
): string[] {
  const ids = new Set<string>();
  if (actor.employeeId) ids.add(actor.employeeId);
  for (const emp of employees) {
    if (emp.userId && emp.userId === actor.uid) ids.add(emp.id);
  }
  return [...ids];
}
