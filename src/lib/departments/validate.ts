import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { Department } from "@/types";

/** Server-side: ensure department exists and is active before assignment. */
export async function getActiveDepartmentOrThrow(departmentId: string): Promise<Department> {
  const snap = await adminDb.collection(COLLECTIONS.departments).doc(departmentId).get();
  if (!snap.exists) {
    throw new Error("Department not found");
  }
  const dept = { id: snap.id, ...snap.data() } as Department;
  if (!dept.isActive) {
    throw new Error(`Department "${dept.name}" is inactive — choose another or reactivate it`);
  }
  return dept;
}
