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
import { generateTemporaryPassword } from "@/lib/onboarding/temp-password";
import type { UserProfile } from "@/types";

export async function POST(
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
      { success: false, error: "Only Super Admin can reset staff passwords" },
      { status: 403 }
    );
  }

  const { id } = await params;

  const ref = adminDb.collection(COLLECTIONS.users).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const user = { id: snap.id, ...snap.data() } as UserProfile;

  if (user.role === "super_admin") {
    return NextResponse.json(
      { success: false, error: "Super Admin passwords must be changed from Settings" },
      { status: 400 }
    );
  }

  if (user.isActive === false) {
    return NextResponse.json(
      { success: false, error: "Activate the account before resetting password" },
      { status: 400 }
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const now = new Date().toISOString();

  try {
    await adminAuth.updateUser(id, { password: temporaryPassword });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to reset password",
      },
      { status: 500 }
    );
  }

  await ref.update({
    mustChangePassword: true,
    updatedAt: now,
  });

  await writeAuditLog({
    actorId: verified.auth.uid,
    actorEmail: verified.auth.email,
    actorRole: verified.auth.role,
    action: "update",
    resourceType: "user",
    resourceId: id,
    description: `Reset password for ${user.displayName} (${user.email})`,
  });

  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";

  return NextResponse.json({
    success: true,
    credentials: {
      email: user.email,
      temporaryPassword,
      loginUrl: origin ? `${origin}/login` : "/login",
      oneTime: true,
    },
  });
}
