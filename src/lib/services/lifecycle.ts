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
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore/lite";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import { auth } from "@/lib/firebase/client";
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
  getStageIndex,
  nextStage,
} from "@/lib/lifecycle/stages";
import { generateId, nowISO } from "@/lib/services/helpers";
import { isDemoMode } from "@/lib/demo/data";
import { createNotification } from "@/lib/services/notifications";
import {
  appendDemoEvent,
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
  await createNotification(params);
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

/** Super Admin only — removes employee + related lifecycle records (+ Auth in live mode). */
export async function deleteEmployeeLifecycle(employeeId: string): Promise<void> {
  if (isDemoMode()) {
    const store = readLifecycleStore();
    store.employees = store.employees.filter((e) => e.id !== employeeId);
    store.events = store.events.filter((e) => e.employeeId !== employeeId);
    store.approvals = store.approvals.filter((a) => a.employeeId !== employeeId);
    writeLifecycleStore(store);
    return;
  }

  if (!auth.currentUser) {
    throw new Error("You must be signed in to delete employees");
  }
  const token = await auth.currentUser.getIdToken(true);
  const res = await fetch(`/api/employees/${employeeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(json.error || "Delete failed");
  }
}

const EMPLOYEE_LIST_PAGE = 200;

export type ListEmployeesOpts = {
  /** When set, fetch only this employee doc (safe for employee role). */
  employeeId?: string;
};

/**
 * List employees for lifecycle UIs.
 * Staff roles may list the collection. Pass `employeeId` for self-scoped reads
 * (employees cannot run an unfiltered collection query under security rules).
 */
export async function listEmployeesForLifecycle(
  opts?: ListEmployeesOpts
): Promise<Employee[]> {
  if (isDemoMode()) {
    const rows = readLifecycleStore().employees;
    if (opts?.employeeId) {
      return rows.filter((e) => e.id === opts.employeeId);
    }
    return rows;
  }

  if (opts?.employeeId) {
    const snap = await getDoc(doc(db, COLLECTIONS.employees, opts.employeeId));
    if (!snap.exists()) return [];
    return [{ id: snap.id, ...snap.data() } as Employee];
  }

  const all: Employee[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    const base = [orderBy("createdAt", "desc"), limit(EMPLOYEE_LIST_PAGE)] as const;
    const snap = cursor
      ? await getDocs(
          query(collection(db, COLLECTIONS.employees), ...base, startAfter(cursor))
        )
      : await getDocs(query(collection(db, COLLECTIONS.employees), ...base));
    if (snap.empty) break;
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Employee));
    if (snap.size < EMPLOYEE_LIST_PAGE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  return all;
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

  const fromIdx = getStageIndex(employee.lifecycleStage);
  const toIdx = getStageIndex(params.toStage);
  if (toIdx < fromIdx && params.toStage !== employee.lifecycleStage) {
    throw new Error(
      `Cannot regress lifecycle from ${employee.lifecycleStage} to ${params.toStage}`
    );
  }

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
  if (!employee.verifiedAt) {
    throw new Error("Complete HR verification before assigning induction modules");
  }

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

  const { assertEmployeeInductionComplete } = await import("@/lib/services/induction");
  await assertEmployeeInductionComplete(employeeId);

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
  const { listDepartments } = await import("@/lib/services/departments");
  const departments = await listDepartments().catch(() => []);
  const department = departments.find((d) => d.id === departmentId);
  if (!department) {
    throw new Error("Department not found");
  }
  if (!department.isActive) {
    throw new Error(`Department "${department.name}" is inactive`);
  }
  const departmentName = department.name || department.code;

  if (!isDemoMode()) {
    const { handoverEmployee } = await import("@/lib/services/employees");
    await handoverEmployee(employeeId, departmentId, actor.uid, departmentName);
  }

  return advanceLifecycle({
    employeeId,
    toStage: "department_handover",
    actor,
    description: "Employee handed over to department",
    metadata: { departmentId, ...(departmentName ? { departmentName } : {}) },
    employeePatch: {
      departmentId,
      ...(departmentName ? { departmentName } : {}),
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
  const { employee } = await getEmployeeLifecycle(employeeId);
  if (!employee) throw new Error("Employee not found");

  if (employee.jdId && employee.jdId !== jdId) {
    throw new Error("Employee already linked to another Job Description");
  }

  const postHandover = [
    "department_handover",
    "jd_created",
    "tni_created",
    "trainer_assigned",
    "sop_assigned",
    "training",
    "exam",
    "passed",
    "certified",
    "qualified",
  ];
  if (!postHandover.includes(employee.lifecycleStage)) {
    throw new Error("Complete department handover before creating a Job Description");
  }

  if (employee.lifecycleStage === "department_handover") {
    return advanceLifecycle({
      employeeId,
      toStage: "jd_created",
      actor,
      description: "Job description created",
      metadata: { jdId },
      employeePatch: { jdId, status: "active" },
    });
  }

  await patchEmployee(employeeId, { jdId, updatedAt: nowISO(), updatedBy: actor.uid });
  const { employee: updated } = await getEmployeeLifecycle(employeeId);
  if (!updated) throw new Error("Employee not found");
  return updated;
}

export async function createTniLifecycle(
  employeeId: string,
  tniId: string,
  actor: LifecycleActor
): Promise<Employee> {
  const { employee } = await getEmployeeLifecycle(employeeId);
  if (!employee) throw new Error("Employee not found");

  if (employee.tniId && employee.tniId !== tniId) {
    throw new Error("Employee already linked to another TNI");
  }

  const postJd = [
    "jd_created",
    "tni_created",
    "trainer_assigned",
    "sop_assigned",
    "training",
    "exam",
    "passed",
    "certified",
    "qualified",
  ];
  if (!postJd.includes(employee.lifecycleStage)) {
    throw new Error("Create an approved Job Description before submitting TNI");
  }

  if (employee.lifecycleStage === "jd_created") {
    return advanceLifecycle({
      employeeId,
      toStage: "tni_created",
      actor,
      description: "Training Need Identification created",
      metadata: { tniId },
      employeePatch: { tniId },
    });
  }

  await patchEmployee(employeeId, { tniId, updatedAt: nowISO(), updatedBy: actor.uid });
  const { employee: updated } = await getEmployeeLifecycle(employeeId);
  if (!updated) throw new Error("Employee not found");
  return updated;
}

export async function assignTrainerLifecycle(
  employeeId: string,
  trainerId: string,
  actor: LifecycleActor
): Promise<Employee> {
  const { employee } = await getEmployeeLifecycle(employeeId);
  if (!employee) throw new Error("Employee not found");

  const postTni = [
    "tni_created",
    "trainer_assigned",
    "sop_assigned",
    "training",
    "exam",
    "passed",
    "certified",
    "qualified",
  ];
  if (!postTni.includes(employee.lifecycleStage)) {
    throw new Error("Complete TNI before assigning a trainer");
  }

  if (employee.lifecycleStage === "tni_created") {
    return advanceLifecycle({
      employeeId,
      toStage: "trainer_assigned",
      actor,
      description: "Trainer assigned",
      metadata: { trainerId },
      employeePatch: { currentTrainerId: trainerId },
    });
  }

  await patchEmployee(employeeId, {
    currentTrainerId: trainerId,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  });
  const { employee: updated } = await getEmployeeLifecycle(employeeId);
  if (!updated) throw new Error("Employee not found");
  return updated;
}

export async function assignSopLifecycle(
  employeeId: string,
  sopId: string,
  actor: LifecycleActor
): Promise<Employee> {
  const { employee } = await getEmployeeLifecycle(employeeId);
  if (!employee) throw new Error("Employee not found");

  const postTrainer = [
    "trainer_assigned",
    "sop_assigned",
    "training",
    "exam",
    "passed",
    "certified",
    "qualified",
  ];
  if (!postTrainer.includes(employee.lifecycleStage)) {
    throw new Error("Assign a trainer before assigning SOP training");
  }

  if (employee.lifecycleStage === "trainer_assigned") {
    return advanceLifecycle({
      employeeId,
      toStage: "sop_assigned",
      actor,
      description: "SOP training assigned",
      metadata: { sopId },
    });
  }

  const { employee: updated } = await getEmployeeLifecycle(employeeId);
  if (!updated) throw new Error("Employee not found");
  return updated;
}

export async function validateTrainingAssignmentLifecycle(
  employeeId: string
): Promise<Employee> {
  const { employee } = await getEmployeeLifecycle(employeeId);
  if (!employee) throw new Error("Employee not found");

  const allowed = [
    "tni_created",
    "trainer_assigned",
    "sop_assigned",
    "training",
    "exam",
    "passed",
    "certified",
    "qualified",
  ];
  if (!allowed.includes(employee.lifecycleStage)) {
    throw new Error(
      `${employee.firstName} ${employee.lastName}: complete TNI before assigning training (stage: ${employee.lifecycleStage})`
    );
  }
  return employee;
}

export async function markTrainingLifecycle(
  employeeId: string,
  actor: LifecycleActor
): Promise<Employee> {
  const { employee } = await getEmployeeLifecycle(employeeId);
  if (!employee) throw new Error("Employee not found");

  const atOrAfterTraining = ["training", "exam", "passed", "certified", "qualified"];
  if (atOrAfterTraining.includes(employee.lifecycleStage)) {
    return employee;
  }

  const canAdvanceFrom = ["sop_assigned", "trainer_assigned"];
  if (!canAdvanceFrom.includes(employee.lifecycleStage)) {
    throw new Error("Assign SOP training before completing a training session");
  }

  return advanceLifecycle({
    employeeId,
    toStage: "training",
    actor,
    description: "Training session completed",
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
    case "induction_assigned": {
      const { listInductionModules } = await import("@/lib/services/induction");
      const catalog = await listInductionModules();
      const moduleIds = catalog.filter((m) => m.isMandatory).map((m) => m.id);
      if (!moduleIds.length && catalog.length) moduleIds.push(catalog[0].id);
      if (!moduleIds.length) {
        throw new Error("No induction modules in catalog — create modules first");
      }
      return assignInductionLifecycle(employeeId, moduleIds, actor);
    }
    case "induction_completed":
      return completeInductionLifecycle(employeeId, actor);
    case "department_handover": {
      if (!employee.departmentId) {
        throw new Error("Employee has no department — assign a department before handover");
      }
      return handoverLifecycle(employeeId, employee.departmentId, actor);
    }
    case "jd_created":
      throw new Error(
        "Create a Job Description on the JD page first — admin catch-up cannot skip JD content"
      );
    case "tni_created":
      throw new Error(
        "Create a TNI on the TNI page first — admin catch-up cannot skip TNI content"
      );
    case "trainer_assigned":
      throw new Error(
        "Assign a trainer from the Training page — admin catch-up cannot skip trainer selection"
      );
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
