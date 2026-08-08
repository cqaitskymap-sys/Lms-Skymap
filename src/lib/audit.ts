/**
 * Audit helpers — client recording goes through Admin API (Firestore denies client creates).
 */

export { recordAuditEvent, notifyAuditUpdated, AUDIT_UPDATED_EVENT } from "@/lib/services/audit-logs";
export type { AuditListFilters } from "@/lib/services/audit-logs";

import type { AuditAction, UserRole } from "@/types";
import { generateId } from "@/lib/utils";
import { recordAuditEvent } from "@/lib/services/audit-logs";

/**
 * @deprecated Prefer `recordAuditEvent`. Actor identity comes from the session, not params.
 */
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
  void params.actorId;
  void params.actorEmail;
  void params.actorRole;
  const id = await recordAuditEvent({
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    description: params.description,
    before: params.before,
    after: params.after,
  });
  return id || generateId("audit");
}

export function nowISO() {
  return new Date().toISOString();
}
