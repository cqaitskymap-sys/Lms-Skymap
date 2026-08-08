import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  unauthorized,
  verifyAuthDetailed,
  writeAuditLog,
} from "@/lib/rbac/middleware";
import type { AuditAction } from "@/types";

const ACTIONS = [
  "create",
  "update",
  "delete",
  "view",
  "assign",
  "approve",
  "reject",
  "submit",
  "login",
  "logout",
  "upload",
  "download",
  "export",
  "sign",
  "reassign",
] as const satisfies readonly AuditAction[];

const bodySchema = z.object({
  action: z.enum(ACTIONS),
  resourceType: z.string().trim().min(1).max(80),
  resourceId: z.string().trim().min(1).max(120),
  description: z.string().trim().min(3).max(1000),
  before: z.record(z.string(), z.unknown()).optional(),
  after: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Append-only audit entry. Actor fields are taken from the verified session.
 * Allowed for staff roles that hold audit:read (or super_admin).
 */
export async function POST(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  // Any signed-in user may append an audit row for their own actions.
  // Actor fields always come from the verified session — never the client payload.

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid audit payload" },
      { status: 400 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const ua = request.headers.get("user-agent") || undefined;

  const id = await writeAuditLog({
    actorId: verified.auth.uid,
    actorEmail: verified.auth.email,
    actorRole: verified.auth.role,
    action: parsed.data.action,
    resourceType: parsed.data.resourceType,
    resourceId: parsed.data.resourceId,
    description: parsed.data.description,
    before: parsed.data.before,
    after: parsed.data.after,
    ipAddress: ip,
    userAgent: ua,
  });

  return NextResponse.json({ success: true, id });
}
