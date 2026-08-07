/**
 * Employee lifecycle orchestration — advances stages, writes events,
 * approvals, notifications, and activity logs (Firestore or demo store).
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
import { db, COLLECTIONS } from "@/lib/firebase/client";
import type {
  Employee,
  LifecycleApproval,
  LifecycleEvent,
  LifecycleStage,
  Notification,
  UserRole,
  ApprovalType,
} from "@/types";
import {
  getProgressForStage,
  getStageDefinition,
  nextStage,
} from "@/lib/lifecycle/stages";
import { generateId, nowISO } from "@/lib/services/helpers";
import { isDemoMode } from "@/lib/demo/data";
import {
  appendDemoEvent,
  appendDemoNotification,
  readLifecycleStore,
  upsertDemoApproval,
  upsertDemoEmployee,
  writeLifecycleStore,
} from "@/lib/lifecycle/demo-store";
import { logActivity } from "@/lib/services/activity";

export interface LifecycleActor {
  uid: string;
  name: string;
  role: UserRole;
  email?: string;
}

async function notifyUser(params: {
  userId: string;
  type: Notification["type"];
  title: string;
  message: string;
  link?: string;
  actorId: string;
}): Promise<void> {
  const now = nowISO();
  const notification: Notification = {
    id: generateId("notif"),
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    isRead: false,
    createdAt: now,
    updatedAt: now,
    createdBy: params.actorId,
    ...(params.link ? { link: params.link } : {}),
  };

  if (isDemoMode()) {
    appendDemoNotification(notification);
    return;
  }

  await setDoc(doc(db, COLLECTIONS.notifications, notification.id), notification);
}

async function writeEvent(event: LifecycleEvent): Promise<void> {
  if (isDemoMode()) {
    appendDemoEvent(event);
    return;
  }
  await setDoc(doc(db, COLLECTIONS.lifecycleEvents, event.id), event);
}

async function writeApproval(approval: LifecycleApproval): Promise<void> {
  if (isDemoMode()) {
    upsertDemoApproval(approval);
    return;
  }
  await setDoc(doc(db, COLLECTIONS.lifecycleApprovals, approval.id), approval);
}

async function patchEmployee(id: string, data: Partial<Employee>): Promise<void> {
  if (isDemoMode()) {
    const store = readLifecycleStore();
    const emp = store.employees.find((e) => e.id === id);
    if (!emp) throw new Error("Employee not found");
    upsertDemoEmployee({ ...emp, ...data, updatedAt: nowISO() });
    return;
  }
  await updateDoc(doc(db, COLLECTIONS.employees, id), {
    ...data,
    updatedAt: nowISO(),
  });
}

export async function getEmployeeLifecycle(employeeId: string): Promise<{
  employee: Employee | null;
  events: LifecycleEvent[];
  approvals: LifecycleApproval[];
}> {
  if (isDemoMode()) {
    const store = readLifecycleStore();
    return {
      employee: store.employees.find((e) => e.id === employeeId) ?? null,
      events: store.events
        .filter((e) => e.employeeId === employeeId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      approvals: store.approvals.filter((a) => a.employeeId === employeeId),
    };
  }

  const empSnap = await getDoc(doc(db, COLLECTIONS.employees, employeeId));
  const employee = empSnap.exists()
    ? ({ id: empSnap.id, ...empSnap.data() } as Employee)
    : null;

  let events: LifecycleEvent[] = [];
  try {
    const eventsSnap = await getDocs(
      query(
        collection(db, COLLECTIONS.lifecycleEvents),
        where("employeeId", "==", employeeId),
        orderBy("createdAt", "asc"),
        limit(100)
      )
    );
    events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as LifecycleEvent);
  } catch (err) {
    // Index still building — equality-only fallback, sort client-side
    console.warn("[lifecycle] events index unavailable, using fallback", err);
    const eventsSnap = await getDocs(
      query(
        collection(db, COLLECTIONS.lifecycleEvents),
        where("employeeId", "==", employeeId),
        limit(100)
      )
    );
    events = eventsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as LifecycleEvent))
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  }

  let approvals: LifecycleApproval[] = [];
  try {
    const approvalsSnap = await getDocs(
      query(
        collection(db, COLLECTIONS.lifecycleApprovals),
        where("employeeId", "==", employeeId),
        orderBy("requestedAt", "desc"),
        limit(50)
      )
    );
    approvals = approvalsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as LifecycleApproval
    );
  } catch {
    const approvalsSnap = await getDocs(
      query(
        collection(db, COLLECTIONS.lifecycleApprovals),
        where("employeeId", "==", employeeId),
        limit(50)
      )
    );
    approvals = approvalsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as LifecycleApproval)
      .sort((a, b) => (b.requestedAt || "").localeCompare(a.requestedAt || ""));
  }

  return {
    employee,
    events,
    approvals,
  };
}

export async function listPendingApprovals(): Promise<LifecycleApproval[]> {
  if (isDemoMode()) {
    return readLifecycleStore().approvals.filter((a) => a.status === "pending");
  }
  try {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.lifecycleApprovals),
        where("status", "==", "pending"),
        orderBy("requestedAt", "desc"),
        limit(50)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LifecycleApproval);
  } catch (err) {
    // Composite index may still be building — fall back to equality-only query
    console.warn("[lifecycle] pending approvals index unavailable, using fallback", err);
    try {
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.lifecycleApprovals),
          where("status", "==", "pending"),
          limit(50)
        )
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as LifecycleApproval)
        .sort((a, b) => (b.requestedAt || "").localeCompare(a.requestedAt || ""));
    } catch {
      return readLifecycleStore().approvals.filter((a) => a.status === "pending");
    }
  }
}

/** Super Admin only — removes employee + related lifecycle records. */
export async function deleteEmployeeLifecycle(employeeId: string): Promise<void> {
  if (isDemoMode()) {
    const store = readLifecycleStore();
    store.employees = store.employees.filter((e) => e.id !== employeeId);
    store.events = store.events.filter((e) => e.employeeId !== employeeId);
    store.approvals = store.approvals.filter((a) => a.employeeId !== employeeId);
    writeLifecycleStore(store);
    return;
  }

  await deleteDoc(doc(db, COLLECTIONS.employees, employeeId));

  try {
    const [eventsSnap, approvalsSnap] = await Promise.all([
      getDocs(
        query(collection(db, COLLECTIONS.lifecycleEvents), where("employeeId", "==", employeeId))
      ),
      getDocs(
        query(collection(db, COLLECTIONS.lifecycleApprovals), where("employeeId", "==", employeeId))
      ),
    ]);
    await Promise.all([
      ...eventsSnap.docs.map((d) => deleteDoc(d.ref)),
      ...approvalsSnap.docs.map((d) => deleteDoc(d.ref)),
    ]);
  } catch {
    /* related cleanup best-effort */
  }
}

export async function listEmployeesForLifecycle(): Promise<Employee[]> {
  if (isDemoMode()) {
    return readLifecycleStore().employees;
  }
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.employees), orderBy("createdAt", "desc"), limit(100))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Employee);
}

/** Create employee at lifecycle stage `created` and queue HR verification approval. */
export async function createEmployeeWithLifecycle(
  data: Omit<
    Employee,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "createdBy"
    | "lifecycleStage"
    | "lifecycleProgress"
    | "status"
    | "inductionStatus"
  >,
  actor: LifecycleActor
): Promise<Employee> {
  const id = generateId("emp");
  const now = nowISO();
  const stage: LifecycleStage = "created";
  const def = getStageDefinition(stage);

  const employee: Employee = {
    ...data,
    id,
    status: def.employeeStatus,
    lifecycleStage: stage,
    lifecycleProgress: def.progress,
    inductionStatus: "not_started",
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  };

  // Firestore rejects explicit `undefined` field values
  const firestorePayload = Object.fromEntries(
    Object.entries(employee).filter(([, v]) => v !== undefined)
  ) as Employee;

  if (isDemoMode()) {
    upsertDemoEmployee(firestorePayload);
  } else {
    await setDoc(doc(db, COLLECTIONS.employees, id), firestorePayload);
  }

  await recordStageEvent({
    employeeId: id,
    stage,
    actor,
    description: `Employee ${employee.employeeCode} created`,
  });

  // Auto-advance to HR verification + create approval
  await advanceLifecycle({
    employeeId: id,
    toStage: "hr_verification",
    actor,
    description: "Awaiting HR verification",
  });

  await requestApproval({
    employeeId: id,
    type: "hr_verification",
    title: "HR Verification required",
    description: `Verify documents for ${employee.firstName} ${employee.lastName}`,
    stage: "hr_verification",
    actor,
  });

  const notifyTarget = employee.userId || actor.uid;
  await notifyUser({
    userId: notifyTarget,
    type: "system",
    title: "New employee created",
    message: `${employee.firstName} ${employee.lastName} is pending HR verification.`,
    link: `/dashboard/employees/${id}`,
    actorId: actor.uid,
  });

  return employee;
}

export async function recordStageEvent(params: {
  employeeId: string;
  stage: LifecycleStage;
  actor: LifecycleActor;
  description: string;
  metadata?: Record<string, string>;
}): Promise<LifecycleEvent> {
  const def = getStageDefinition(params.stage);
  const event: LifecycleEvent = {
    id: generateId("lev"),
    employeeId: params.employeeId,
    stage: params.stage,
    title: def.label,
    description: params.description,
    status: "completed",
    actorId: params.actor.uid,
    actorName: params.actor.name,
    actorRole: params.actor.role,
    completedAt: nowISO(),
    createdAt: nowISO(),
    // Firestore rejects explicit `undefined` field values — omit when absent
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };
  await writeEvent(event);

  void logActivity({
    userId: params.actor.uid,
    employeeId: params.employeeId,
    verb: "lifecycle_advanced",
    summary: params.description,
    resourceType: "employee",
    resourceId: params.employeeId,
    metadata: { stage: params.stage },
  });

  return event;
}

export async function advanceLifecycle(params: {
  employeeId: string;
  toStage: LifecycleStage;
  actor: LifecycleActor;
  description?: string;
  metadata?: Record<string, string>;
  /** Extra employee field patches */
  employeePatch?: Partial<Employee>;
}): Promise<Employee> {
  const { employee } = await getEmployeeLifecycle(params.employeeId);
  if (!employee) throw new Error("Employee not found");

  const def = getStageDefinition(params.toStage);
  const alreadyAtStage = employee.lifecycleStage === params.toStage;

  const patch: Partial<Employee> = {
    lifecycleStage: params.toStage,
    lifecycleProgress: getProgressForStage(params.toStage),
    status: def.employeeStatus,
    updatedBy: params.actor.uid,
    ...params.employeePatch,
  };

  if (params.toStage === "induction_completed") {
    patch.inductionStatus = "passed";
    patch.inductionCompletedAt = nowISO();
  }
  if (params.toStage === "qualified") {
    patch.qualifiedAt = nowISO();
  }

  await patchEmployee(params.employeeId, patch);

  // Re-entering the same stage (e.g. TNI create + Advance) should update
  // employee fields without duplicating events/notifications.
  if (alreadyAtStage) {
    return { ...employee, ...patch } as Employee;
  }

  await recordStageEvent({
    employeeId: params.employeeId,
    stage: params.toStage,
    actor: params.actor,
    description: params.description || `Advanced to ${def.label}`,
    metadata: params.metadata,
  });

  // Mark current stage event
  const currentEvent: LifecycleEvent = {
    id: generateId("lev"),
    employeeId: params.employeeId,
    stage: params.toStage,
    title: def.label,
    description: `Current stage: ${def.label}`,
    status: "current",
    actorId: params.actor.uid,
    actorName: params.actor.name,
    actorRole: params.actor.role,
    createdAt: nowISO(),
  };
  await writeEvent(currentEvent);

  // Admin-facing inbox: always notify the actor. Employee-facing alerts for
  // assignments/exams are created separately via createNotification.
  await notifyUser({
    userId: params.actor.uid,
    type: "system",
    title: `Lifecycle: ${def.label}`,
    message: params.description || def.description,
    link: `/dashboard/employees/${params.employeeId}`,
    actorId: params.actor.uid,
  });

  return { ...employee, ...patch } as Employee;
}

export async function requestApproval(params: {
  employeeId: string;
  type: ApprovalType;
  title: string;
  description: string;
  stage: LifecycleStage;
  actor: LifecycleActor;
}): Promise<LifecycleApproval> {
  const approval: LifecycleApproval = {
    id: generateId("appr"),
    employeeId: params.employeeId,
    type: params.type,
    title: params.title,
    description: params.description,
    status: "pending",
    requestedBy: params.actor.uid,
    requestedByName: params.actor.name,
    requestedAt: nowISO(),
    stage: params.stage,
  };
  await writeApproval(approval);
  return approval;
}

export async function reviewApproval(params: {
  approvalId: string;
  decision: "approved" | "rejected";
  comments?: string;
  actor: LifecycleActor;
}): Promise<{ approval: LifecycleApproval; employee?: Employee }> {
  let approval: LifecycleApproval | undefined;

  if (isDemoMode()) {
    const store = readLifecycleStore();
    approval = store.approvals.find((a) => a.id === params.approvalId);
  } else {
    const snap = await getDoc(doc(db, COLLECTIONS.lifecycleApprovals, params.approvalId));
    if (snap.exists()) approval = { id: snap.id, ...snap.data() } as LifecycleApproval;
  }

  if (!approval) throw new Error("Approval not found");
  if (approval.status !== "pending") throw new Error("Approval already reviewed");

  const updated: LifecycleApproval = {
    ...approval,
    status: params.decision,
    reviewedBy: params.actor.uid,
    reviewedByName: params.actor.name,
    reviewedAt: nowISO(),
    // Firestore rejects explicit `undefined` field values — omit when absent
    ...(params.comments ? { comments: params.comments } : {}),
  };
  await writeApproval(updated);

  if (params.decision === "rejected") {
    await recordStageEvent({
      employeeId: approval.employeeId,
      stage: approval.stage,
      actor: params.actor,
      description: `Approval rejected: ${approval.title}`,
      metadata: { approvalId: approval.id },
    });
    return { approval: updated };
  }

  // Approved — advance based on type
  let employee: Employee | undefined;
  switch (approval.type) {
    case "hr_verification":
      employee = await advanceLifecycle({
        employeeId: approval.employeeId,
        toStage: "hr_verification",
        actor: params.actor,
        description: "HR verification approved",
        employeePatch: { verifiedAt: nowISO(), verifiedBy: params.actor.uid, status: "verified" },
      });
      break;
    case "department_handover":
      employee = await advanceLifecycle({
        employeeId: approval.employeeId,
        toStage: "department_handover",
        actor: params.actor,
        description: "Department handover approved",
      });
      break;
    case "jd_approval":
      employee = await advanceLifecycle({
        employeeId: approval.employeeId,
        toStage: "jd_created",
        actor: params.actor,
        description: "Job description approved",
      });
      break;
    case "tni_approval":
      employee = await advanceLifecycle({
        employeeId: approval.employeeId,
        toStage: "tni_created",
        actor: params.actor,
        description: "TNI approved",
      });
      break;
    default:
      break;
  }

  return { approval: updated, employee };
}

/** HR verifies employee (shortcut if no separate approval UI click). */
export async function verifyEmployee(
  employeeId: string,
  actor: LifecycleActor
): Promise<Employee> {
  const pending = (await getEmployeeLifecycle(employeeId)).approvals.find(
    (a) => a.type === "hr_verification" && a.status === "pending"
  );
  if (pending) {
    const result = await reviewApproval({
      approvalId: pending.id,
      decision: "approved",
      actor,
      comments: "Verified by HR",
    });
    return result.employee!;
  }
  return advanceLifecycle({
    employeeId,
    toStage: "hr_verification",
    actor,
    description: "HR verification completed",
    employeePatch: {
      verifiedAt: nowISO(),
      verifiedBy: actor.uid,
      status: "verified",
    },
  });
}

export async function assignInductionLifecycle(
  employeeId: string,
  moduleIds: string[],
  actor: LifecycleActor
): Promise<Employee> {
  const { employee } = await getEmployeeLifecycle(employeeId);
  if (!employee) throw new Error("Employee not found");

  const { assignInductionModules } = await import("@/lib/services/induction");
  await assignInductionModules(employeeId, moduleIds, actor.uid);

  return advanceLifecycle({
    employeeId,
    toStage: "induction_assigned",
    actor,
    description: `Assigned ${moduleIds.length} induction module(s)`,
    metadata: { moduleIds: moduleIds.join(",") },
    employeePatch: {
      status: "induction",
      inductionStatus: "in_progress",
    },
  });
}

export async function completeInductionLifecycle(
  employeeId: string,
  actor: LifecycleActor,
  opts?: { requireSignedPaper?: boolean }
): Promise<Employee> {
  const { employee } = await getEmployeeLifecycle(employeeId);
  if (!employee) throw new Error("Employee not found");

  if (opts?.requireSignedPaper !== false && !employee.inductionSignedPaper?.downloadUrl) {
    throw new Error(
      "Upload the signed induction paper (department heads signatures) before marking induction complete"
    );
  }

  return advanceLifecycle({
    employeeId,
    toStage: "induction_completed",
    actor,
    description: employee.inductionSignedPaper
      ? "Induction completed — signed paper uploaded by HR"
      : "Induction completed and assessment passed",
    metadata: employee.inductionSignedPaper
      ? {
          signedPaper: employee.inductionSignedPaper.fileName,
          signedPaperUrl: employee.inductionSignedPaper.downloadUrl,
        }
      : undefined,
    employeePatch: {
      inductionStatus: "passed",
      inductionCompletedAt: nowISO(),
      status: "induction_complete",
    },
  });
}

export async function handoverLifecycle(
  employeeId: string,
  departmentId: string,
  actor: LifecycleActor
): Promise<Employee> {
  if (!isDemoMode()) {
    const { handoverEmployee } = await import("@/lib/services/employees");
    await handoverEmployee(employeeId, departmentId, actor.uid);
  }

  return advanceLifecycle({
    employeeId,
    toStage: "department_handover",
    actor,
    description: "Employee handed over to department",
    metadata: { departmentId },
    employeePatch: {
      departmentId,
      handedOverAt: nowISO(),
      handedOverBy: actor.uid,
      status: "handed_over",
    },
  });
}

export async function createJdLifecycle(
  employeeId: string,
  jdId: string,
  actor: LifecycleActor
): Promise<Employee> {
  return advanceLifecycle({
    employeeId,
    toStage: "jd_created",
    actor,
    description: "Job description created",
    metadata: { jdId },
    employeePatch: { jdId, status: "active" },
  });
}

export async function createTniLifecycle(
  employeeId: string,
  tniId: string,
  actor: LifecycleActor
): Promise<Employee> {
  return advanceLifecycle({
    employeeId,
    toStage: "tni_created",
    actor,
    description: "Training Need Identification created",
    metadata: { tniId },
    employeePatch: { tniId },
  });
}

export async function assignTrainerLifecycle(
  employeeId: string,
  trainerId: string,
  actor: LifecycleActor
): Promise<Employee> {
  return advanceLifecycle({
    employeeId,
    toStage: "trainer_assigned",
    actor,
    description: "Trainer assigned",
    metadata: { trainerId },
    employeePatch: { currentTrainerId: trainerId },
  });
}

export async function assignSopLifecycle(
  employeeId: string,
  sopId: string,
  actor: LifecycleActor
): Promise<Employee> {
  return advanceLifecycle({
    employeeId,
    toStage: "sop_assigned",
    actor,
    description: "SOP training assigned",
    metadata: { sopId },
  });
}

export async function markTrainingLifecycle(
  employeeId: string,
  actor: LifecycleActor
): Promise<Employee> {
  return advanceLifecycle({
    employeeId,
    toStage: "training",
    actor,
    description: "Training in progress / completed session",
  });
}

export async function markExamLifecycle(
  employeeId: string,
  actor: LifecycleActor
): Promise<Employee> {
  return advanceLifecycle({
    employeeId,
    toStage: "exam",
    actor,
    description: "Exam started / submitted",
  });
}

export async function markPassedLifecycle(
  employeeId: string,
  actor: LifecycleActor,
  score?: number
): Promise<Employee> {
  return advanceLifecycle({
    employeeId,
    toStage: "passed",
    actor,
    description: score != null ? `Assessment passed with ${score}%` : "Assessment passed",
    ...(score != null ? { metadata: { score: String(score) } } : {}),
  });
}

export async function markCertifiedLifecycle(
  employeeId: string,
  certificateId: string,
  actor: LifecycleActor
): Promise<Employee> {
  return advanceLifecycle({
    employeeId,
    toStage: "certified",
    actor,
    description: "Certificate issued",
    metadata: { certificateId },
  });
}

export async function markQualifiedLifecycle(
  employeeId: string,
  actor: LifecycleActor
): Promise<Employee> {
  return advanceLifecycle({
    employeeId,
    toStage: "qualified",
    actor,
    description: "Employee marked as qualified",
    employeePatch: { qualifiedAt: nowISO(), status: "qualified" },
  });
}

/** Simulate remaining pipeline steps (demo / admin catch-up). */
export async function advanceToNext(
  employeeId: string,
  actor: LifecycleActor
): Promise<Employee> {
  const { employee } = await getEmployeeLifecycle(employeeId);
  if (!employee) throw new Error("Employee not found");
  const next = nextStage(employee.lifecycleStage);
  if (!next) throw new Error("Already at final stage");

  switch (next) {
    case "hr_verification":
      return verifyEmployee(employeeId, actor);
    case "induction_assigned":
      return assignInductionLifecycle(employeeId, ["ind_001"], actor);
    case "induction_completed":
      return completeInductionLifecycle(employeeId, actor);
    case "department_handover":
      return handoverLifecycle(
        employeeId,
        employee.departmentId || "dept_qa",
        actor
      );
    case "jd_created":
      return createJdLifecycle(employeeId, generateId("jd"), actor);
    case "tni_created":
      return createTniLifecycle(employeeId, generateId("tni"), actor);
    case "trainer_assigned":
      return assignTrainerLifecycle(employeeId, "user_trainer", actor);
    case "sop_assigned":
      return assignSopLifecycle(employeeId, "sop_001", actor);
    case "training":
      return markTrainingLifecycle(employeeId, actor);
    case "exam":
      return markExamLifecycle(employeeId, actor);
    case "passed":
      return markPassedLifecycle(employeeId, actor, 88);
    case "certified":
      return markCertifiedLifecycle(employeeId, generateId("cert"), actor);
    case "qualified":
      return markQualifiedLifecycle(employeeId, actor);
    default:
      return advanceLifecycle({ employeeId, toStage: next, actor });
  }
}

export function lifecycleDashboardStats(employees: Employee[]) {
  return {
    total: employees.length,
    pendingVerification: employees.filter((e) => e.lifecycleStage === "hr_verification").length,
    inductionInProgress: employees.filter((e) =>
      ["induction_assigned"].includes(e.lifecycleStage)
    ).length,
    readyForHandover: employees.filter((e) => e.lifecycleStage === "induction_completed").length,
    inTraining: employees.filter((e) =>
      ["sop_assigned", "training", "exam", "trainer_assigned"].includes(e.lifecycleStage)
    ).length,
    qualified: employees.filter((e) => e.lifecycleStage === "qualified").length,
    avgProgress: employees.length
      ? Math.round(
          employees.reduce((s, e) => s + (e.lifecycleProgress || 0), 0) / employees.length
        )
      : 0,
  };
}
