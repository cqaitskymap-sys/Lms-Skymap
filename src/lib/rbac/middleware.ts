import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { UserProfile, UserRole, AuditAction } from "@/types";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";
import { generateId } from "@/lib/utils";

export interface AuthenticatedRequest {
  uid: string;
  email: string;
  profile: UserProfile;
  role: UserRole;
}

export type AuthFailureReason =
  | "missing_token"
  | "admin_not_configured"
  | "invalid_token"
  | "profile_missing"
  | "inactive";

export async function verifyAuth(
  request: NextRequest
): Promise<AuthenticatedRequest | null> {
  const result = await verifyAuthDetailed(request);
  return result.ok ? result.auth : null;
}

export async function verifyAuthDetailed(
  request: NextRequest
): Promise<
  | { ok: true; auth: AuthenticatedRequest }
  | { ok: false; reason: AuthFailureReason; message: string }
> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return {
      ok: false,
      reason: "missing_token",
      message: "Missing Authorization Bearer token. Sign in again.",
    };
  }

  if (!isAdminConfigured()) {
    return {
      ok: false,
      reason: "admin_not_configured",
      message:
        "Firebase Admin SDK is not configured. Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in .env.local, then restart the dev server.",
    };
  }

  try {
    const token = header.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    const snap = await adminDb.collection(COLLECTIONS.users).doc(decoded.uid).get();
    if (!snap.exists) {
      return {
        ok: false,
        reason: "profile_missing",
        message:
          "Your user profile was not found in Firestore (users/{uid}). Sign out and sign in again, or ask an admin to create your profile.",
      };
    }

    const profile = { id: snap.id, ...snap.data() } as UserProfile;
    if (profile.isActive === false) {
      return {
        ok: false,
        reason: "inactive",
        message: "Account is deactivated.",
      };
    }

    return {
      ok: true,
      auth: {
        uid: decoded.uid,
        email: decoded.email || profile.email,
        profile,
        role: profile.role,
      },
    };
  } catch (err) {
    console.error("[verifyAuth]", err);
    return {
      ok: false,
      reason: "invalid_token",
      message: "Invalid or expired session. Sign out and sign in again.",
    };
  }
}

export function requirePermission(auth: AuthenticatedRequest, permission: Permission) {
  if (!hasPermission(auth.role, permission)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }
  return null;
}

export function unauthorized(message = "Unauthorized", status = 401) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function writeAuditLog(params: {
  actorId: string;
  actorEmail: string;
  actorRole: UserRole;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const id = generateId("audit");
  await adminDb.collection(COLLECTIONS.auditLogs).doc(id).set({
    id,
    timestamp: new Date().toISOString(),
    ...params,
  });
  return id;
}
