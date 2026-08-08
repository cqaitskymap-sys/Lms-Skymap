import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  unauthorized,
  verifyAuthDetailed,
  writeAuditLog,
} from "@/lib/rbac/middleware";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { Employee } from "@/types";

async function deleteQueryBatch(
  collectionName: string,
  field: string,
  value: string
): Promise<number> {
  const snap = await adminDb
    .collection(collectionName)
    .where(field, "==", value)
    .limit(500)
    .get();
  if (snap.empty) return 0;
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

/**
 * Super Admin — permanently remove employee, lifecycle records, linked Auth user,
 * and related assignments.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminConfigured()) {
    return unauthorized(
      "Firebase Admin SDK is required to delete employees. Configure service account credentials and restart the server.",
      503
    );
  }

  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    return unauthorized(
      verified.message,
      verified.reason === "admin_not_configured" ? 503 : 401
    );
  }
  const auth = verified.auth;

  if (auth.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden: Super Admin only" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const empRef = adminDb.collection(COLLECTIONS.employees).doc(id);
  const empSnap = await empRef.get();
  if (!empSnap.exists) {
    return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
  }

  const employee = { id: empSnap.id, ...empSnap.data() } as Employee;
  const userId = employee.userId;

  await deleteQueryBatch(COLLECTIONS.lifecycleEvents, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.lifecycleApprovals, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.inductionAssignments, "employeeId", id);
  await deleteQueryBatch(COLLECTIONS.trainingAssignments, "employeeId", id);

  await empRef.delete();

  if (userId) {
    try {
      await adminDb.collection(COLLECTIONS.users).doc(userId).delete();
    } catch {
      /* best-effort */
    }
    try {
      await adminAuth.deleteUser(userId);
    } catch {
      /* user may already be removed from Auth */
    }
  }

  await writeAuditLog({
    actorId: auth.uid,
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "delete",
    resourceType: "employee",
    resourceId: id,
    description: `Deleted employee ${employee.employeeCode}${userId ? " and linked Auth account" : ""}`,
    before: employee as unknown as Record<string, unknown>,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  return NextResponse.json({ success: true, message: "Employee deleted" });
}
