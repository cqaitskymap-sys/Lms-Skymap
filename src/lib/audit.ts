import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import type { AuditAction, UserRole } from "@/types";
import { generateId } from "@/lib/utils";

export async function logAuditClient(params: {
  actorId: string;
  actorEmail: string;
  actorRole: UserRole;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  const id = generateId("audit");
  await addDoc(collection(db, COLLECTIONS.auditLogs), {
    id,
    timestamp: new Date().toISOString(),
    ...params,
  });
  return id;
}

export function nowISO() {
  return new Date().toISOString();
}

export { serverTimestamp };
