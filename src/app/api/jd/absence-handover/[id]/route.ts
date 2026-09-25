import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unauthorized, verifyAuthDetailed, writeAuditLog } from "@/lib/rbac/middleware";
import { acknowledgeJdSignoffForUser } from "@/lib/jd/absence-handover-server";
import { JD_SIGNOFF_SLOTS, parseJdSignoffSlot } from "@/lib/jd/absence-handover";

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
    return NextResponse.json({ success: false, error: "JD id required" }, { status: 400 });
  }

  let slotRaw: string | undefined;
  try {
    const body = (await request.json()) as { slot?: string };
    slotRaw = body.slot;
  } catch {
    slotRaw = undefined;
  }
  const slot = parseJdSignoffSlot(slotRaw);

  try {
    const jd = await acknowledgeJdSignoffForUser(id.trim(), slot, {
      uid: verified.auth.uid,
      name: verified.auth.profile.displayName || verified.auth.email,
      employeeId: verified.auth.profile.employeeId,
    });

    await writeAuditLog({
      actorId: verified.auth.uid,
      actorEmail: verified.auth.email,
      actorRole: verified.auth.role,
      action: "approve",
      resourceType: "job_description",
      resourceId: jd.id,
      description: `Approved ${JD_SIGNOFF_SLOTS[slot].label} e-signature on ${jd.jdNo || jd.id}`,
    }).catch(() => undefined);

    return NextResponse.json({ success: true, jd });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Approval failed";
    const status =
      message.includes("not found") ? 404 : message.includes("Only the named") ? 403 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
