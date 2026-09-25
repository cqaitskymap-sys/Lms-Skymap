import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unauthorized, verifyAuthDetailed } from "@/lib/rbac/middleware";
import { listAbsenceHandoverJdsForUser } from "@/lib/jd/absence-handover-server";
import { actorPendingSlots, JD_SIGNOFF_SLOTS } from "@/lib/jd/absence-handover";

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
    const { items, extraEmployeeIds } = await listAbsenceHandoverJdsForUser(actor);
    const pending = items.flatMap((jd) =>
      actorPendingSlots(jd, actor, extraEmployeeIds).map((slot) => ({
        jdId: jd.id,
        slot,
        label: JD_SIGNOFF_SLOTS[slot].label,
        actionLabel: JD_SIGNOFF_SLOTS[slot].actionLabel,
        title: jd.title,
        jdNo: jd.jdNo || jd.id,
        effectiveFrom: jd.effectiveFrom,
      }))
    );
    return NextResponse.json({
      success: true,
      items,
      pending,
    });
  } catch (err) {
    console.error("[jd/absence-handover]", err);
    return NextResponse.json(
      { success: false, error: "Could not load assigned Job Descriptions" },
      { status: 500 }
    );
  }
}
