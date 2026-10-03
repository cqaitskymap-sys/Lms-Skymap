/**
 * Client-side audit log listing + optional API-backed recording.
 */

import { collection, getDocs, orderBy, query, limit } from "firebase/firestore/lite";
import { db, COLLECTIONS, auth } from "@/lib/firebase/client";
import type { AuditAction, AuditLog, UserProfile, UserRole } from "@/types";
import { isoInLocalDateRange } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo/data";
import { readLifecycleStore } from "@/lib/lifecycle/demo-store";
import type { LifecycleEvent } from "@/types";

export const AUDIT_UPDATED_EVENT = "pharma-audit-updated";

export function notifyAuditUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUDIT_UPDATED_EVENT));
}

export type AuditListFilters = {
  max?: number;
  action?: string; // "all" | AuditAction
  resourceType?: string; // "all" | string
  search?: string;
  dateFrom?: string; // yyyy-mm-dd
  dateTo?: string;
};

function lifecycleToAudit(events: LifecycleEvent[]): AuditLog[] {
  return events.map((e) => ({
    id: e.id,
    timestamp: e.createdAt,
    actorId: e.actorId || "system",
    actorEmail: e.actorId || "system",
    actorName: e.actorName,
    actorRole: (e.actorRole || "employee") as UserRole,
    action: "update" as AuditAction,
    resourceType: "employee_lifecycle",
    resourceId: e.employeeId,
    description: e.description || e.title || `${e.stage} · ${e.status}`,
  }));
}

/** Name plus employee / staff code for the Actor column. Email is only a last resort for @pharma.local codes. */
export function auditActorParts(log: Pick<AuditLog, "actorName" | "actorEmployeeCode" | "actorEmail">): {
  name: string;
  code: string;
} {
  const email = (log.actorEmail || "").trim();
  const localPart = email.includes("@") ? email.split("@")[0] : "";
  const pharmaCode = email.toLowerCase().endsWith("@pharma.local") ? localPart : "";
  const code = (log.actorEmployeeCode || pharmaCode).trim();
  let name = (log.actorName || "").trim();
  if (!name && email && !email.includes("@")) name = email;
  if (!name || name.includes("@") || (email.includes("@") && name.toLowerCase() === email.toLowerCase())) {
    name = "";
  }
  if (code && name.toLowerCase() === code.toLowerCase()) name = "";
  if (!name && !code && localPart) return { name: "", code: localPart };
  return { name, code };
}

export function auditActorText(log: Pick<AuditLog, "actorName" | "actorEmployeeCode" | "actorEmail">): string {
  const { name, code } = auditActorParts(log);
  if (name && code) return `${name} (${code})`;
  return name || code || "—";
}

function mapDoc(d: { id: string; data: () => Record<string, unknown> }): AuditLog {
  const data = d.data();
  return {
    id: (data.id as string) || d.id,
    timestamp: (data.timestamp as string) || new Date().toISOString(),
    actorId: data.actorId as string,
    actorEmail: (data.actorEmail as string) || "",
    actorName: data.actorName as string | undefined,
    actorEmployeeCode: data.actorEmployeeCode as string | undefined,
    actorRole: data.actorRole as UserRole,
    action: data.action as AuditAction,
    resourceType: data.resourceType as string,
    resourceId: data.resourceId as string,
    description: data.description as string,
    before: data.before as Record<string, unknown> | undefined,
    after: data.after as Record<string, unknown> | undefined,
    ipAddress: data.ipAddress as string | undefined,
    userAgent: data.userAgent as string | undefined,
  };
}

async function fetchRemoteAuditLogs(max: number): Promise<AuditLog[]> {
  const q = query(
    collection(db, COLLECTIONS.auditLogs),
    orderBy("timestamp", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc({ id: d.id, data: () => d.data() as Record<string, unknown> }));
}

function inDateRange(iso: string, dateFrom?: string, dateTo?: string): boolean {
  return isoInLocalDateRange(iso, dateFrom, dateTo);
}

function applyFilters(rows: AuditLog[], filters?: AuditListFilters): AuditLog[] {
  if (!filters) return rows;
  return rows.filter((a) => {
    if (filters.action && filters.action !== "all" && a.action !== filters.action) {
      return false;
    }
    if (
      filters.resourceType &&
      filters.resourceType !== "all" &&
      a.resourceType !== filters.resourceType
    ) {
      return false;
    }
    if (!inDateRange(a.timestamp, filters.dateFrom, filters.dateTo)) return false;
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      const blob = `${a.description} ${auditActorText(a)} ${a.actorEmployeeCode || ""} ${a.actorRole} ${a.action} ${a.resourceType} ${a.resourceId}`;
      if (!blob.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/** Fill name and employee code on older rows that only stored an email. */
async function enrichAuditActors(logs: AuditLog[]): Promise<AuditLog[]> {
  if (logs.length === 0) return logs;
  const directory = await loadActorDirectory();
  if (directory.size === 0) return logs;
  return logs.map((log) => {
    const hit = directory.get(log.actorId);
    if (!hit) return log;
    return {
      ...log,
      actorName: log.actorName || hit.name || undefined,
      actorEmployeeCode: log.actorEmployeeCode || hit.code || undefined,
    };
  });
}

async function loadActorDirectory(): Promise<Map<string, { name: string; code: string }>> {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.users));
    const map = new Map<string, { name: string; code: string }>();
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as Partial<UserProfile>;
      const entry = {
        name: (data.displayName || "").trim(),
        code: (data.username || "").trim(),
      };
      map.set(docSnap.id, entry);
      if (data.uid) map.set(data.uid, entry);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function listAuditLogs(
  maxOrFilters: number | AuditListFilters = 500
): Promise<AuditLog[]> {
  const filters: AuditListFilters =
    typeof maxOrFilters === "number" ? { max: maxOrFilters } : maxOrFilters;
  const max = filters.max ?? 500;

  if (isDemoMode()) {
    const local = lifecycleToAudit(readLifecycleStore().events);
    let remote: AuditLog[] = [];
    try {
      remote = await fetchRemoteAuditLogs(max);
    } catch {
      /* demo: remote optional when Admin wrote login/onboard audits */
    }
    const byId = new Map<string, AuditLog>();
    for (const row of [...remote, ...local]) byId.set(row.id, row);
    const merged = [...byId.values()].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    return applyFilters(await enrichAuditActors(merged), filters).slice(0, max);
  }

  const remote = await enrichAuditActors(await fetchRemoteAuditLogs(max));
  return applyFilters(remote, filters);
}

/**
 * Record an audit event via Admin SDK API (client Firestore create is denied).
 * Actor identity is always taken from the verified session — not the payload.
 */
export async function recordAuditEvent(params: {
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken();
    const res = await fetch("/api/audit", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    notifyAuditUpdated();
    return body.id || null;
  } catch {
    return null;
  }
}

export function exportAuditLogsCsv(logs: AuditLog[], filename = "audit-trail.csv") {
  const headers = [
    "Timestamp",
    "Actor",
    "Role",
    "Action",
    "Resource",
    "Resource ID",
    "Description",
    "IP",
  ];
  const lines = [
    headers.join(","),
    ...logs.map((a) =>
      [
        a.timestamp,
        auditActorText(a),
        a.actorRole || "",
        a.action,
        a.resourceType,
        a.resourceId,
        a.description,
        a.ipAddress || "",
      ]
        .map((v) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = filename;
  el.click();
  URL.revokeObjectURL(url);
}
