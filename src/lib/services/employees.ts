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
} from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import type { Employee, PaginatedResult } from "@/types";
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
  actorId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.employees, employeeId), {
    status: "handed_over",
    departmentId,
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
