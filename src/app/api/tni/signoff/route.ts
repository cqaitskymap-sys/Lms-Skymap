import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unauthorized, verifyAuthDetailed } from "@/lib/rbac/middleware";
import { listTniSignoffsForUser } from "@/lib/tni/signoff-server";
import { actorPendingTniSlots, TNI_SIGNOFF_SLOTS } from "@/lib/tni/signoff";

export async function GET(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  try {
    const actor = {
      uid: verified.auth.uid,
      employeeId: verified.auth.profile.employeeId,
    };
    const { items, extraEmployeeIds } = await listTniSignoffsForUser(actor);
    const pending = items.flatMap((tni) =>
      actorPendingTniSlots(tni, actor, extraEmployeeIds).map((slot) => ({
        tniId: tni.id,
        slot,
        label: TNI_SIGNOFF_SLOTS[slot].label,
        actionLabel: TNI_SIGNOFF_SLOTS[slot].actionLabel,
        title: TNI_SIGNOFF_SLOTS[slot].label,
        employeeId: tni.employeeId,
        createdAt: tni.createdAt,
      }))
    );
    return NextResponse.json({
      success: true,
      items,
      pending,
    });
  } catch (err) {
    console.error("[tni/signoff]", err);
    return NextResponse.json(
      { success: false, error: "Could not load assigned TNIs" },
      { status: 500 }
    );
  }
}
