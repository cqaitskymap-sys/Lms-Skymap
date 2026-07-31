/**
 * Departments — list, create, update, delete (org units for employees, SOPs, training).
 */

import { auth, db, COLLECTIONS } from "@/lib/firebase/client";
import { isDemoMode } from "@/lib/demo/data";
import {
  departmentIdFromCode,
  toDefaultDepartments,
} from "@/lib/departments/defaults";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "@/lib/auth/department-schemas";
import type { Department } from "@/types";
import { generateId } from "@/lib/utils";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export const DEPARTMENTS_UPDATED_EVENT = "pharma-departments-updated";
const DEMO_DEPT_KEY = "pharma_lms_departments";

function notifyDepartmentsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DEPARTMENTS_UPDATED_EVENT));
  }
}

function readDemoDepartments(): Department[] {
  if (typeof window === "undefined") return toDefaultDepartments();
  try {
    const raw = localStorage.getItem(DEMO_DEPT_KEY);
    if (!raw) {
      const seeded = toDefaultDepartments();
      localStorage.setItem(DEMO_DEPT_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as Department[];
  } catch {
    return toDefaultDepartments();
  }
}

function writeDemoDepartments(departments: Department[]) {
  localStorage.setItem(DEMO_DEPT_KEY, JSON.stringify(departments));
  notifyDepartmentsUpdated();
}

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in");
  const token = await user.getIdToken(true);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/** Sync fallback for server-side or static imports — default pharma list. */
export function getDepartmentsSync(): Department[] {
  if (typeof window !== "undefined") {
    return readDemoDepartments();
  }
  return toDefaultDepartments();
}

export async function listDepartments(): Promise<Department[]> {
  if (isDemoMode()) {
    return readDemoDepartments().sort((a, b) => a.name.localeCompare(b.name));
  }

  try {
    const res = await fetch("/api/departments", { headers: await authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.departments)) {
      return json.departments as Department[];
    }
  } catch {
    /* fall through to client Firestore */
  }

  const q = query(collection(db, COLLECTIONS.departments), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Department));
}

export async function seedPharmaDepartments(): Promise<{ added: number; total: number }> {
  if (isDemoMode()) {
    const existing = readDemoDepartments();
    const codes = new Set(existing.map((d) => d.code.toUpperCase()));
    const now = new Date().toISOString();
    const toAdd = toDefaultDepartments().filter((d) => !codes.has(d.code.toUpperCase()));
    const merged = [
      ...existing,
      ...toAdd.map((d) => ({ ...d, createdAt: now, updatedAt: now })),
    ];
    writeDemoDepartments(merged);
    return { added: toAdd.length, total: merged.length };
  }

  const res = await fetch("/api/departments/seed", {
    method: "POST",
    headers: await authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to seed departments");
  notifyDepartmentsUpdated();
  return { added: json.added, total: json.total };
}

export async function createDepartment(input: CreateDepartmentInput): Promise<Department> {
  const code = input.code.toUpperCase();
  const now = new Date().toISOString();

  if (isDemoMode()) {
    const all = readDemoDepartments();
    if (all.some((d) => d.code.toUpperCase() === code)) {
      throw new Error(`Department code "${code}" already exists`);
    }
    const dept: Department = {
      id: departmentIdFromCode(code),
      code,
      name: input.name,
      description: input.description || undefined,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      createdBy: "super_admin",
    };
    writeDemoDepartments([...all, dept]);
    return dept;
  }

  const res = await fetch("/api/departments", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = json.details
      ? Object.values(json.details as Record<string, string[]>)
          .flat()
          .join("; ")
      : "";
    throw new Error(details || json.error || "Failed to create department");
  }
  notifyDepartmentsUpdated();
  return json.department as Department;
}

export async function updateDepartment(
  id: string,
  input: UpdateDepartmentInput
): Promise<Department> {
  const now = new Date().toISOString();

  if (isDemoMode()) {
    const all = readDemoDepartments();
    const idx = all.findIndex((d) => d.id === id);
    if (idx < 0) throw new Error("Department not found");

    if (input.code) {
      const code = input.code.toUpperCase();
      if (all.some((d) => d.id !== id && d.code.toUpperCase() === code)) {
        throw new Error(`Department code "${code}" already exists`);
      }
    }

    const updated: Department = {
      ...all[idx]!,
      ...(input.code !== undefined ? { code: input.code.toUpperCase() } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description || undefined }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: now,
    };
    all[idx] = updated;
    writeDemoDepartments(all);
    return updated;
  }

  const res = await fetch(`/api/departments/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to update department");
  notifyDepartmentsUpdated();
  return json.department as Department;
}

export async function deleteDepartment(id: string): Promise<void> {
  if (isDemoMode()) {
    const all = readDemoDepartments().filter((d) => d.id !== id);
    if (all.length === readDemoDepartments().length) {
      throw new Error("Department not found");
    }
    writeDemoDepartments(all);
    return;
  }

  const res = await fetch(`/api/departments/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Failed to delete department");
  notifyDepartmentsUpdated();
}

export function departmentLabel(
  departments: Department[],
  id?: string
): string {
  if (!id) return "—";
  return departments.find((d) => d.id === id)?.name || id;
}
