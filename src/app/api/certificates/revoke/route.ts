import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { unauthorized, verifyAuthDetailed, writeAuditLog } from "@/lib/rbac/middleware";
import { hasPermission } from "@/lib/rbac/permissions";
import { revokeCertificateServer } from "@/lib/certificates/issue-server";

const bodySchema = z.object({
  certificateId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  if (!hasPermission(verified.auth.role, "certificates:revoke")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "certificateId and reason (min 3 chars) required" },
      { status: 400 }
    );
  }

  const result = await revokeCertificateServer(
    parsed.data.certificateId,
    parsed.data.reason,
    verified.auth.uid
  );
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  await writeAuditLog({
    actorId: verified.auth.uid,
    actorEmail: verified.auth.email,
    actorRole: verified.auth.role,
    action: "update",
    resourceType: "certificate",
    resourceId: parsed.data.certificateId,
    description: `Certificate ${result.certificate.certificateNumber} revoked: ${parsed.data.reason.trim()}`,
    after: {
      isRevoked: true,
      revokedReason: parsed.data.reason.trim(),
    },
  });

  return NextResponse.json({ success: true, certificate: result.certificate });
}
