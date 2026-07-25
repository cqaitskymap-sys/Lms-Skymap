/**
 * Server-side auth helpers for Server Actions / Route Handlers.
 * Verifies Firebase ID token (Bearer) and loads the user profile.
 */

import "server-only";

import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/constants/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { UserProfile, UserRole } from "@/types";
import { assertPermission, AuthorizationError } from "@/lib/rbac/assert";
import type { Permission } from "@/lib/rbac/permissions";

export interface ServerAuthContext {
  uid: string;
  email: string;
  profile: UserProfile;
  role: UserRole;
}

function adminReady() {
  return Boolean(
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

export async function getServerAuthFromBearer(
  authorizationHeader: string | null
): Promise<ServerAuthContext | null> {
  if (!adminReady()) return null;
  if (!authorizationHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authorizationHeader.slice(7);
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

export async function getServerAuthFromSession(): Promise<ServerAuthContext | null> {
  if (!adminReady()) return null;
  try {
    const jar = await cookies();
    const session = jar.get(AUTH_COOKIE_NAME)?.value;
    if (!session) return null;
    const decoded = await adminAuth.verifySessionCookie(session, true);
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

export async function requireServerAuth(
  permission?: Permission
): Promise<ServerAuthContext> {
  const auth = await getServerAuthFromSession();
  if (!auth) {
    throw new AuthorizationError("Unauthorized");
  }
  if (permission) {
    assertPermission(auth.role, permission);
  }
  return auth;
}
