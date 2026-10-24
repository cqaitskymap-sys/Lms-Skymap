/**
 * Admin-saved JD lists: sub departments, designations, and responsibilities.
 * One document per department. When a document exists, it replaces the built-in lists.
 */

import { auth } from "@/lib/firebase/client";
import { isDemoMode } from "@/lib/demo/data";
import {
  normalizeJdCatalogDraft,
  type JdMasterRecord,
} from "@/lib/jd/catalog-master";
import type { JdCatalogSnapshot } from "@/lib/jd/responsibility-catalog";

export const JD_CATALOG_UPDATED_EVENT = "pharma-jd-catalog-updated";
const DEMO_KEY = "pharma_lms_jd_catalog";

function notifyUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(JD_CATALOG_UPDATED_EVENT));
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readDemo(): JdMasterRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as JdMasterRecord[]) : [];
  } catch {
    return [];
  }
}

function writeDemo(rows: JdMasterRecord[]) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
  notifyUpdated();
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

export async function listJdMasters(): Promise<JdMasterRecord[]> {
  if (isDemoMode()) return readDemo();
  const res = await fetch("/api/jd-catalog", { headers: await authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(json.masters)) {
    throw new Error(typeof json.error === "string" ? json.error : "Could not load JD lists");
  }
  return json.masters as JdMasterRecord[];
}

export async function saveJdMaster(input: {
  departmentId: string;
  sections: JdCatalogSnapshot["sections"];
  designations: JdCatalogSnapshot["designations"];
  updatedBy?: string;
}): Promise<JdMasterRecord> {
  const departmentId = input.departmentId.trim();
  if (!departmentId) throw new Error("Department is required");
  const normalized = normalizeJdCatalogDraft({
    sections: input.sections,
    designations: input.designations,
  });
  const record: JdMasterRecord = {
    id: departmentId,
    departmentId,
    sections: normalized.sections,
    designations: normalized.designations,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };
  const stored = clone(record);

  if (isDemoMode()) {
    const rows = readDemo().filter((row) => row.departmentId !== departmentId);
    writeDemo([...rows, stored]);
    return stored;
  }

  if (!auth.currentUser) throw new Error("You must be signed in");
  const res = await fetch("/api/jd-catalog", {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(stored),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "Could not save JD lists");
  }
  notifyUpdated();
  return (json.master as JdMasterRecord) || stored;
}

export async function deleteJdMaster(departmentId: string): Promise<void> {
  if (!departmentId) return;
  if (isDemoMode()) {
    writeDemo(readDemo().filter((row) => row.departmentId !== departmentId));
    return;
  }
  if (!auth.currentUser) throw new Error("You must be signed in");
  const res = await fetch(
    `/api/jd-catalog?departmentId=${encodeURIComponent(departmentId)}`,
    { method: "DELETE", headers: await authHeaders() }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "Could not restore the original lists");
  }
  notifyUpdated();
}
