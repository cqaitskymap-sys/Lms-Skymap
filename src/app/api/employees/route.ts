import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAuth, requirePermission, unauthorized, writeAuditLog } from "@/lib/rbac/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { generateId } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorized();
  const denied = requirePermission(auth, "employees:read");
  if (denied) return denied;

  const snap = await adminDb.collection(COLLECTIONS.employees).orderBy("createdAt", "desc").limit(50).get();
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorized();
  const denied = requirePermission(auth, "employees:write");
  if (denied) return denied;

  const body = await request.json();
  const id = generateId("emp");
  const now = new Date().toISOString();
  const employee = {
    ...body,
    id,
    status: body.status || "draft",
    inductionStatus: "not_started",
    createdAt: now,
    updatedAt: now,
    createdBy: auth.uid,
  };

  await adminDb.collection(COLLECTIONS.employees).doc(id).set(employee);
  await writeAuditLog({
    actorId: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "create",
    resourceType: "employee",
    resourceId: id,
    description: `Created employee ${employee.employeeCode}`,
    after: employee,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  return NextResponse.json({ success: true, data: employee }, { status: 201 });
}
