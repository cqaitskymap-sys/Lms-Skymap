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
  type QueryConstraint,
} from "firebase/firestore/lite";
import { auth, db, COLLECTIONS } from "@/lib/firebase/client";
import { isDemoMode } from "@/lib/demo/data";
import {
  resolveOnboardingEmail,
  type UpdateEmployeeProfileInput,
} from "@/lib/auth/onboarding-schemas";
import { readLifecycleStore, writeLifecycleStore } from "@/lib/lifecycle/demo-store";
import type { Employee, LifecycleEvent, PaginatedResult, UserRole } from "@/types";
import { generateId, nowISO } from "@/lib/services/helpers";

export async function createEmployee(
  data: Omit<Employee, "id" | "createdAt" | "updatedAt" | "createdBy">,
  actorId: string
): Promise<Employee> {
  const id = generateId("emp");
  const now = nowISO();
  const employee: Employee = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };
  await setDoc(doc(db, COLLECTIONS.employees, id), employee);
  return employee;
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.employees, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Employee;
}

export async function updateEmployee(
  id: string,
  data: Partial<Employee>,
  actorId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.employees, id), {
    ...data,
    updatedAt: nowISO(),
    updatedBy: actorId,
  });
}

export interface EmployeeProfileActor {
  uid: string;
  name: string;
  role: UserRole;
}

/**
 * Correct an employee profile after onboarding.
 * Login username follows the employee code; a blank email keeps code@pharma.local.
 */
export async function saveEmployeeProfile(
  employeeId: string,
  input: UpdateEmployeeProfileInput & { departmentName?: string },
  actor: EmployeeProfileActor
): Promise<void> {
  if (isDemoMode()) {
    saveEmployeeProfileLocally(employeeId, input, actor);
    return;
  }

  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to edit employees");
  const token = await user.getIdToken();
  const res = await fetch(`/api/employees/${employeeId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    details?: Record<string, string[] | undefined>;
  };
  if (!res.ok || json.success === false) {
    const details = json.details;
    if (details) {
      const first = Object.entries(details).find(([, msgs]) => msgs && msgs.length > 0);
      if (first?.[1]?.[0]) throw new Error(`${first[0]}: ${first[1][0]}`);
    }
    throw new Error(json.error || `Failed to update employee (${res.status})`);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pharma-lifecycle-updated"));
  }
}

function saveEmployeeProfileLocally(
  employeeId: string,
  input: UpdateEmployeeProfileInput & { departmentName?: string },
  actor: EmployeeProfileActor
): void {
  const store = readLifecycleStore();
  const current = store.employees.find((e) => e.id === employeeId);
  if (!current) throw new Error("Employee not found");

  const employeeCode = input.employeeCode;
  const email = resolveOnboardingEmail(input.email, employeeCode);
  if (
    store.employees.some(
      (e) => e.id !== employeeId && e.employeeCode.toUpperCase() === employeeCode
    )
  ) {
    throw new Error("An employee with this employee code already exists");
  }
  if (
    store.employees.some((e) => e.id !== employeeId && e.email.toLowerCase() === email)
  ) {
    throw new Error("An employee with this email already exists");
  }

  const now = nowISO();
  const displayName = `${input.firstName} ${input.lastName}`.trim();
  const next: Employee = {
    ...current,
    employeeCode,
    username: employeeCode,
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.mobile,
    mobile: input.mobile,
    designation: input.designation,
    departmentId: input.departmentId,
    departmentName: input.departmentName || current.departmentName,
    dateOfJoining: input.dateOfJoining,
    employmentType: "permanent",
    reportingManagerId: input.reportingManagerId || undefined,
    reportingManagerName: input.reportingManagerName || undefined,
    updatedAt: now,
    updatedBy: actor.uid,
  };
  store.employees = store.employees.map((e) => (e.id === employeeId ? next : e));

  const event: LifecycleEvent = {
    id: generateId("lev"),
    employeeId,
    stage: current.lifecycleStage || "created",
    title: "Profile updated",
    description: `Updated profile for ${displayName} (${employeeCode})`,
    status: "completed",
    actorId: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    completedAt: now,
    createdAt: now,
    metadata: { kind: "profile_update" },
  };
  store.events = [event, ...store.events];
  writeLifecycleStore(store);
}

export async function listEmployees(params: {
  page?: number;
  pageSize?: number;
  departmentId?: string;
  status?: string;
  search?: string;
}): Promise<PaginatedResult<Employee>> {
  const pageSize = params.pageSize ?? 20;
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(pageSize)];

  if (params.departmentId) {
    constraints.unshift(where("departmentId", "==", params.departmentId));
  }
  if (params.status) {
    constraints.unshift(where("status", "==", params.status));
  }

  const q = query(collection(db, COLLECTIONS.employees), ...constraints);
  const snap = await getDocs(q);
  let data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Employee);

  if (params.search) {
    const s = params.search.toLowerCase();
    data = data.filter(
      (e) =>
        e.firstName.toLowerCase().includes(s) ||
        e.lastName.toLowerCase().includes(s) ||
        e.email.toLowerCase().includes(s) ||
        e.employeeCode.toLowerCase().includes(s)
    );
  }

  return {
    data,
    total: data.length,
    page: params.page ?? 1,
    pageSize,
    totalPages: Math.ceil(data.length / pageSize) || 1,
  };
}

export async function handoverEmployee(
  employeeId: string,
  departmentId: string,
  actorId: string,
  departmentName?: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.employees, employeeId), {
    status: "handed_over",
    departmentId,
    ...(departmentName ? { departmentName } : {}),
    handedOverAt: nowISO(),
    handedOverBy: actorId,
    updatedAt: nowISO(),
    updatedBy: actorId,
  });
}

export async function deleteEmployee(id: string): Promise<void> {
  const { deleteEmployeeLifecycle } = await import("@/lib/services/lifecycle");
  await deleteEmployeeLifecycle(id);
}
