import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  unauthorized,
  verifyAuthDetailed,
  requirePermission,
  writeAuditLog,
} from "@/lib/rbac/middleware";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { toDefaultDepartments, departmentIdFromCode } from "@/lib/departments/defaults";
import type { Department } from "@/types";

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return unauthorized("Firebase Admin SDK is not configured.", 503);
  }

  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  const denied = requirePermission(verified.auth, "departments:write");
  if (denied) return denied;

  const snap = await adminDb.collection(COLLECTIONS.departments).get();
  const existingCodes = new Set(
    snap.docs.map((d) => (d.data().code as string).toUpperCase())
  );

  const now = new Date().toISOString();
  const batch = adminDb.batch();
  let added = 0;

  for (const template of toDefaultDepartments()) {
    if (existingCodes.has(template.code.toUpperCase())) continue;
    const id = departmentIdFromCode(template.code);
    const dept: Department = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: verified.auth.uid,
    };
    batch.set(adminDb.collection(COLLECTIONS.departments).doc(id), dept);
    added++;
  }

  if (added > 0) {
    await batch.commit();
  }

  const totalSnap = await adminDb.collection(COLLECTIONS.departments).get();

  await writeAuditLog({
    actorId: verified.auth.uid,
    actorEmail: verified.auth.email,
    actorRole: verified.auth.role,
    action: "create",
    resourceType: "department",
    resourceId: "bulk_seed",
    description: `Seeded ${added} standard pharma departments`,
    after: { added, total: totalSnap.size },
  });

  return NextResponse.json({ success: true, added, total: totalSnap.size });
}
