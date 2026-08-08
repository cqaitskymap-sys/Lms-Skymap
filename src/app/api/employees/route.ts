import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAuth, requirePermission, unauthorized } from "@/lib/rbac/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorized();
  const denied = requirePermission(auth, "employees:read");
  if (denied) return denied;

  const snap = await adminDb
    .collection(COLLECTIONS.employees)
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorized();
  const denied = requirePermission(auth, "employees:write");
  if (denied) return denied;

  return NextResponse.json(
    {
      success: false,
      error:
        "This endpoint is deprecated. Use POST /api/employees/onboard to create employees with Auth accounts and lifecycle records.",
    },
    { status: 410 }
  );
}
