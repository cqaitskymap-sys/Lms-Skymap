import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unauthorized, verifyAuthDetailed, writeAuditLog } from "@/lib/rbac/middleware";
import { acknowledgeTniSignoffForUser } from "@/lib/tni/signoff-server";
import { parseTniSignoffSlot, TNI_SIGNOFF_SLOTS } from "@/lib/tni/signoff";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ success: false, error: "TNI id required" }, { status: 400 });
  }

  let slotRaw: string | undefined;
  try {
    const body = (await request.json()) as { slot?: string };
    slotRaw = body.slot;
  } catch {
    slotRaw = undefined;
  }
  const slot = parseTniSignoffSlot(slotRaw);

  try {
    const tni = await acknowledgeTniSignoffForUser(id.trim(), slot, {
      uid: verified.auth.uid,
      name: verified.auth.profile.displayName || verified.auth.email,
      employeeId: verified.auth.profile.employeeId,
    });

    await writeAuditLog({
      actorId: verified.auth.uid,
      actorEmail: verified.auth.email,
      actorRole: verified.auth.role,
      action: "approve",
      resourceType: "tni",
      resourceId: tni.id,
      description: `Approved ${TNI_SIGNOFF_SLOTS[slot].label} e-signature on ${tni.id}`,
    }).catch(() => undefined);

    return NextResponse.json({ success: true, tni });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Approval failed";
    const status =
      message.includes("not found") ? 404 : message.includes("Only the named") ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
