import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  unauthorized,
  verifyAuthDetailed,
  requirePermission,
  writeAuditLog,
} from "@/lib/rbac/middleware";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { updateAdminUserSchema } from "@/lib/auth/user-admin-schemas";
import { normalizeAllowedModules } from "@/lib/rbac/modules";
import type { UserProfile } from "@/types";

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

  const denied = requirePermission(verified.auth, "users:write");
  if (denied) return denied;

  if (verified.auth.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Only Super Admin can update staff accounts" },
      { status: 403 }
    );
  }

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateAdminUserSchema.safeParse(raw);
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

  const ref = adminDb.collection(COLLECTIONS.users).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const before = { id: snap.id, ...snap.data() } as UserProfile;

  if (before.role === "super_admin") {
    return NextResponse.json(
      { success: false, error: "Super Admin accounts cannot be edited from here" },
      { status: 400 }
    );
  }

  if (input.isActive === false && id === verified.auth.uid) {
    return NextResponse.json(
      { success: false, error: "You cannot deactivate your own account" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const updates: Partial<UserProfile> = { updatedAt: now };

  if (input.displayName !== undefined) updates.displayName = input.displayName;
  if (input.phone !== undefined) updates.phone = input.phone || undefined;
  if (input.isActive !== undefined) updates.isActive = input.isActive;
  if (input.role !== undefined) updates.role = input.role;
  if (input.departmentId !== undefined) {
    updates.departmentId = input.departmentId || undefined;
  }

  const nextRole = input.role ?? before.role;
  if (input.allowedModules !== undefined || input.role !== undefined) {
    updates.allowedModules = normalizeAllowedModules(
      nextRole,
      input.allowedModules ?? before.allowedModules ?? []
    );
  }

  await ref.update(updates);

  const authUpdates: { disabled?: boolean; displayName?: string } = {};
  if (input.isActive !== undefined) authUpdates.disabled = !input.isActive;
  if (input.displayName !== undefined) authUpdates.displayName = input.displayName;
  if (Object.keys(authUpdates).length > 0) {
    await adminAuth.updateUser(id, authUpdates);
  }

  const nextDept = input.departmentId !== undefined ? input.departmentId || undefined : before.departmentId;

  const claims: Record<string, string> = { role: nextRole };
  if (nextDept) claims.departmentId = nextDept;
  await adminAuth.setCustomUserClaims(id, claims);

  if (nextRole === "department_head" && nextDept) {
    await adminDb.collection(COLLECTIONS.departments).doc(nextDept).set(
      { headUserId: id, updatedAt: now },
      { merge: true }
    );
  }

  const after = { ...before, ...updates };

  await writeAuditLog({
    actorId: verified.auth.uid,
    actorEmail: verified.auth.email,
    actorRole: verified.auth.role,
    action: "update",
    resourceType: "user",
    resourceId: id,
    description: `Updated staff account ${before.displayName} (${before.email})`,
    before: {
      role: before.role,
      isActive: before.isActive,
      departmentId: before.departmentId ?? null,
      allowedModules: before.allowedModules ?? null,
    },
    after: {
      role: after.role,
      isActive: after.isActive,
      departmentId: after.departmentId ?? null,
      allowedModules: after.allowedModules ?? null,
    },
  });

  return NextResponse.json({ success: true, user: after });
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

  const denied = requirePermission(verified.auth, "users:delete");
  if (denied) return denied;

  if (verified.auth.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Only Super Admin can delete staff accounts" },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (id === verified.auth.uid) {
    return NextResponse.json(
      { success: false, error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  const ref = adminDb.collection(COLLECTIONS.users).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const user = { id: snap.id, ...snap.data() } as UserProfile;

  if (user.role === "super_admin") {
    return NextResponse.json(
      { success: false, error: "Super Admin accounts cannot be deleted from here" },
      { status: 400 }
    );
  }

  try {
    await adminAuth.deleteUser(id);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : "";
    if (code !== "auth/user-not-found") {
      return NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Failed to delete authentication account",
        },
        { status: 500 }
      );
    }
  }

  await ref.delete();

  await writeAuditLog({
    actorId: verified.auth.uid,
    actorEmail: verified.auth.email,
    actorRole: verified.auth.role,
    action: "delete",
    resourceType: "user",
    resourceId: id,
    description: `Deleted staff account ${user.displayName} (${user.email})`,
    before: {
      role: user.role,
      email: user.email,
      departmentId: user.departmentId ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
