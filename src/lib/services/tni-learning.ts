/**
 * After department handover, JD + TNI drive which SOPs an employee must read
 * before they can sit the linked exam.
 */

import { doc, setDoc, updateDoc } from "firebase/firestore/lite";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import { generateId, nowISO } from "@/lib/services/helpers";
import { isDemoMode } from "@/lib/demo/data";
import {
  getEmployeeAssignments,
  listTNIs,
} from "@/lib/services/training";
import { notifyEmployee } from "@/lib/services/notifications";
import {
  preferTrainingLocal,
  readTrainingStore,
  writeTrainingStore,
  notifyTrainingUpdated,
} from "@/lib/training/demo-store";
import {
  listAcknowledgementsForUser,
  listSopsDetailed,
} from "@/lib/services/sops";
import type { SopActor } from "@/lib/services/sops";
import type { TrainingAssignment } from "@/types";

export type TniLearningItem = {
  sopId: string;
  title: string;
  sopNumber: string;
  acknowledged: boolean;
};

export type TniLearningProgress = {
  hasTni: boolean;
  items: TniLearningItem[];
  acknowledgedCount: number;
  allRead: boolean;
  acknowledgedSopIds: string[];
};

function tniSopIdsFromNeeds(
  needs: { sopId?: string }[] | undefined
): string[] {
  return Array.from(
    new Set((needs || []).map((n) => n.sopId).filter((id): id is string => Boolean(id)))
  );
}

export async function getEmployeeTniLearning(
  employeeId: string,
  userId: string
): Promise<TniLearningProgress> {
  const [tnis, catalog, acks] = await Promise.all([
    listTNIs({ employeeId }).catch(() => []),
    listSopsDetailed().catch(() => []),
    listAcknowledgementsForUser(userId).catch(() => []),
  ]);
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const sopIds = tniSopIdsFromNeeds(tnis.flatMap((t) => t.needs || []));
  const items: TniLearningItem[] = sopIds.map((sopId) => {
    const sop = byId.get(sopId);
    const currentVersionId = sop?.currentVersionId || sop?.version?.id;
    const acknowledged = acks.some(
      (a) => a.sopId === sopId && (!currentVersionId || a.versionId === currentVersionId)
    );
    return {
      sopId,
      title: sop?.title || sopId,
      sopNumber: sop?.sopNumber || "",
      acknowledged,
    };
  });
  const acknowledgedSopIds = items.filter((i) => i.acknowledged).map((i) => i.sopId);
  const acknowledgedCount = items.filter((i) => i.acknowledged).length;
  return {
    hasTni: tnis.length > 0,
    items,
    acknowledgedCount,
    allRead: items.length > 0 && acknowledgedCount === items.length,
    acknowledgedSopIds,
  };
}

/** Create self-paced training rows for every SOP listed on the employee's TNI. */
export async function assignTniSopsToEmployee(params: {
  employeeId: string;
  actorId: string;
}): Promise<TrainingAssignment[]> {
  const tnis = await listTNIs({ employeeId: params.employeeId });
  const sopIds = Array.from(new Set(tnis.flatMap((t) => tniSopIdsFromNeeds(t.needs))));
  if (!sopIds.length) return [];

  const { listSopsDetailed } = await import("@/lib/services/sops");
  const { getEmployeeLifecycle } = await import("@/lib/services/lifecycle");
  const [{ employee }, catalog, existing] = await Promise.all([
    getEmployeeLifecycle(params.employeeId),
    listSopsDetailed(),
    getEmployeeAssignments(params.employeeId),
  ]);
  if (!employee) throw new Error("Employee not found");

  const departmentId = employee.departmentId || tnis[0]?.departmentId || "";
  const now = nowISO();
  const created: TrainingAssignment[] = [];
  const local = preferTrainingLocal() || isDemoMode();

  for (const sopId of sopIds) {
    const already = existing.some(
      (a) =>
        a.sopId === sopId && a.status !== "passed" && a.status !== "failed"
    );
    if (already) continue;

    const sop = catalog.find((s) => s.id === sopId);
    const assignment: TrainingAssignment = {
      id: generateId("ta"),
      employeeId: params.employeeId,
      sopId,
      sopVersionId: sop?.currentVersionId || sop?.version?.id || "current",
      assignedBy: params.actorId,
      departmentId,
      status: "assigned",
      attemptCount: 0,
      isRetraining: false,
      triggeredBySopRevision: false,
      createdAt: now,
      updatedAt: now,
      createdBy: params.actorId,
    };
    created.push(assignment);

    if (local) {
      const store = readTrainingStore();
      store.assignments.push(assignment);
      writeTrainingStore(store);
    } else {
      await setDoc(
        doc(db, COLLECTIONS.trainingAssignments, assignment.id),
        JSON.parse(JSON.stringify(assignment))
      );
    }
  }

  if (created.length) {
    await notifyEmployee({
      employeeId: params.employeeId,
      type: "assignment",
      title: "TNI SOPs assigned",
      message: "Read and acknowledge each SOP from your TNI, then take that SOP's exam.",
      link: "/dashboard/sops",
      actorId: params.actorId,
    });
    notifyTrainingUpdated();
  }

  return created;
}

async function patchAssignment(
  assignment: TrainingAssignment,
  patch: Partial<TrainingAssignment>,
  actorId: string
) {
  const now = nowISO();
  const local = preferTrainingLocal() || isDemoMode();
  if (local) {
    const store = readTrainingStore();
    store.assignments = store.assignments.map((a) =>
      a.id === assignment.id ? { ...a, ...patch, updatedAt: now, updatedBy: actorId } : a
    );
    writeTrainingStore(store);
    return;
  }
  await updateDoc(doc(db, COLLECTIONS.trainingAssignments, assignment.id), {
    ...patch,
    updatedAt: now,
    updatedBy: actorId,
  });
}

/** After an SOP acknowledgement, mark TNI training complete and unlock exams. */
export async function syncTniLearningAfterAck(actor: SopActor): Promise<void> {
  const employeeId = actor.employeeId;
  if (!employeeId) return;

  const [progress, assignments] = await Promise.all([
    getEmployeeTniLearning(employeeId, actor.uid),
    getEmployeeAssignments(employeeId),
  ]);
  if (!progress.items.length) return;

  const now = nowISO();
  for (const item of progress.items) {
    const asg = assignments.find(
      (a) => a.sopId === item.sopId && a.status !== "passed" && a.status !== "failed"
    );
    if (!asg) continue;

    // Unlock this SOP's exam as soon as it is acknowledged — do not wait for other TNI SOPs.
    if (
      item.acknowledged &&
      ["assigned", "in_progress", "training_completed"].includes(asg.status)
    ) {
      await patchAssignment(
        asg,
        {
          status: "assessment_pending",
          startedAt: asg.startedAt || now,
          trainingCompletedAt: now,
        },
        actor.uid
      );
    }
  }

  if (progress.items.some((i) => i.acknowledged)) {
    try {
      const { getEmployeeLifecycle, markTrainingLifecycle } = await import(
        "@/lib/services/lifecycle"
      );
      const { employee } = await getEmployeeLifecycle(employeeId);
      if (
        progress.allRead &&
        employee &&
        (employee.lifecycleStage === "sop_assigned" ||
          employee.lifecycleStage === "trainer_assigned")
      ) {
        await markTrainingLifecycle(employeeId, {
          uid: actor.uid,
          name: actor.name,
          role: actor.role,
        });
      }
    } catch (err) {
      console.error("[syncTniLearningAfterAck] lifecycle:", err);
    }

    try {
      await notifyEmployee({
        employeeId,
        type: "assessment",
        title: progress.allRead
          ? "TNI SOPs complete — exams unlocked"
          : "SOP acknowledged — exam unlocked",
        message: progress.allRead
          ? "You have acknowledged all TNI SOPs. You can now take the exams."
          : "You can take the exam for the SOP you just acknowledged.",
        link: "/dashboard/exams",
        actorId: actor.uid,
      });
    } catch (err) {
      console.error("[syncTniLearningAfterAck] notify:", err);
    }
  }

  notifyTrainingUpdated();
}

/** Used by exam start so employees cannot sit a SOP paper before acknowledging that SOP. */
export async function assertTniSopsReadForExam(params: {
  employeeId: string;
  userId: string;
  examSopId?: string;
}): Promise<void> {
  const [progress, assignments] = await Promise.all([
    getEmployeeTniLearning(params.employeeId, params.userId),
    getEmployeeAssignments(params.employeeId).catch(() => []),
  ]);

  if (params.examSopId) {
    const onTni = progress.items.some((i) => i.sopId === params.examSopId);
    const onAssignment = assignments.some((a) => a.sopId === params.examSopId);
    if (!onTni && !onAssignment) {
      throw new Error("This exam is not linked to your assigned SOPs");
    }
    const item = progress.items.find((i) => i.sopId === params.examSopId);
    if (!item?.acknowledged) {
      throw new Error("Read and acknowledge this SOP before taking the exam");
    }
    return;
  }

  if (!progress.hasTni || !progress.items.length) return;
  if (!progress.allRead) {
    throw new Error("Read and acknowledge all TNI SOPs before taking the exam");
  }
}
