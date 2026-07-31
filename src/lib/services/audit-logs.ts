/**
 * Client-side audit log listing — Firestore + lifecycle events fallback.
 */

import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import type { AuditAction, AuditLog, LifecycleEvent, UserRole } from "@/types";
import { isDemoMode } from "@/lib/demo/data";
import { readLifecycleStore } from "@/lib/lifecycle/demo-store";

function lifecycleToAudit(events: LifecycleEvent[]): AuditLog[] {
  return events.map((e) => ({
    id: e.id,
    timestamp: e.createdAt,
    actorId: e.actorId || "system",
    actorEmail: e.actorName || e.actorId || "system",
    actorRole: (e.actorRole || "employee") as UserRole,
    action: "update" as AuditAction,
    resourceType: "employee_lifecycle",
    resourceId: e.employeeId,
    description: e.description || e.title || `${e.stage} · ${e.status}`,
  }));
}

export async function listAuditLogs(max = 200): Promise<AuditLog[]> {
  const lifecycleEvents = readLifecycleStore().events;
  const fromLifecycle = lifecycleToAudit(lifecycleEvents);

  if (isDemoMode()) {
    return fromLifecycle
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, max);
  }

  try {
    const q = query(
      collection(db, COLLECTIONS.auditLogs),
      orderBy("timestamp", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: (data.id as string) || d.id,
        timestamp: (data.timestamp as string) || new Date().toISOString(),
        actorId: data.actorId as string,
        actorEmail: data.actorEmail as string,
        actorRole: data.actorRole as UserRole,
        action: data.action as AuditAction,
        resourceType: data.resourceType as string,
        resourceId: data.resourceId as string,
        description: data.description as string,
        before: data.before as Record<string, unknown> | undefined,
        after: data.after as Record<string, unknown> | undefined,
      } satisfies AuditLog;
    });
    if (rows.length) {
      const merged = [...rows, ...fromLifecycle];
      const seen = new Set<string>();
      return merged
        .filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, max);
    }
  } catch {
    /* fall through */
  }

  return fromLifecycle
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, max);
}
