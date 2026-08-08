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
import { updateDepartmentSchema } from "@/lib/auth/department-schemas";
import type { Department } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateDepartmentSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  if (Object.keys(input).length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  const ref = adminDb.collection(COLLECTIONS.departments).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: "Department not found" }, { status: 404 });
  }

  const before = { id: snap.id, ...snap.data() } as Department;

  if (input.code) {
    const code = input.code.toUpperCase();
    const dup = await adminDb
      .collection(COLLECTIONS.departments)
      .where("code", "==", code)
      .limit(1)
      .get();
    if (!dup.empty && dup.docs[0]!.id !== id) {
      return NextResponse.json(
        { success: false, error: `Department code "${code}" already exists` },
        { status: 409 }
      );
    }
  }

  const now = new Date().toISOString();
  const updates: Partial<Department> = { updatedAt: now };
  if (input.code !== undefined) updates.code = input.code.toUpperCase();
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description || undefined;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  await ref.update(updates);
  const after = { ...before, ...updates };

  await writeAuditLog({
    actorId: verified.auth.uid,
    actorEmail: verified.auth.email,
    actorRole: verified.auth.role,
    action: "update",
    resourceType: "department",
    resourceId: id,
    description: `Updated department ${before.code} — ${before.name}`,
    before: { code: before.code, name: before.name, isActive: before.isActive },
    after: { code: after.code, name: after.name, isActive: after.isActive },
  });

  return NextResponse.json({ success: true, department: after });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminConfigured()) {
    return unauthorized("Firebase Admin SDK is not configured.", 503);
  }

  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  if (verified.auth.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Only Super Admin can delete departments" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const ref = adminDb.collection(COLLECTIONS.departments).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: "Department not found" }, { status: 404 });
  }

  const dept = { id: snap.id, ...snap.data() } as Department;

  const employees = await adminDb
    .collection(COLLECTIONS.employees)
    .where("departmentId", "==", id)
    .limit(1)
    .get();
  if (!employees.empty) {
    return NextResponse.json(
      {
        success: false,
        error: "Cannot delete — employees are assigned to this department. Deactivate it instead.",
      },
      { status: 409 }
    );
  }

  const users = await adminDb
    .collection(COLLECTIONS.users)
    .where("departmentId", "==", id)
    .limit(1)
    .get();
  if (!users.empty) {
    return NextResponse.json(
      {
        success: false,
        error: "Cannot delete — staff accounts are linked to this department. Deactivate it instead.",
      },
      { status: 409 }
    );
  }

  const sops = await adminDb
    .collection(COLLECTIONS.sops)
    .where("departmentIds", "array-contains", id)
    .limit(1)
    .get();
  if (!sops.empty) {
    return NextResponse.json(
      {
        success: false,
        error: "Cannot delete — SOPs reference this department. Deactivate it instead.",
      },
      { status: 409 }
    );
  }

  await ref.delete();

  await writeAuditLog({
    actorId: verified.auth.uid,
    actorEmail: verified.auth.email,
    actorRole: verified.auth.role,
    action: "delete",
    resourceType: "department",
    resourceId: id,
    description: `Deleted department ${dept.code} — ${dept.name}`,
    before: { code: dept.code, name: dept.name },
  });

  return NextResponse.json({ success: true });
}
