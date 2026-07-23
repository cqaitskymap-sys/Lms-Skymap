import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
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

export async function verifyAuth(request: NextRequest): Promise<AuthenticatedRequest | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  try {
    const token = header.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    const snap = await adminDb.collection(COLLECTIONS.users).doc(decoded.uid).get();
    if (!snap.exists) return null;

    const profile = { id: snap.id, ...snap.data() } as UserProfile;
    if (!profile.isActive) return null;

    return {
      uid: decoded.uid,
      email: decoded.email || profile.email,
      profile,
      role: profile.role,
    };
  } catch {
    return null;
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

export function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
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
