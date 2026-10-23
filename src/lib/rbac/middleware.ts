import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { UserProfile, UserRole, AuditAction } from "@/types";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";
import { generateId } from "@/lib/utils";
import { stripUndefined } from "@/lib/services/helpers";
import { checkLoginAllowed } from "@/lib/auth/lockout-server";

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
  | "inactive"
  | "locked";

export async function verifyAuth(
  request: NextRequest
): Promise<AuthenticatedRequest | null> {
  const result = await verifyAuthDetailed(request);
  return result.ok ? result.auth : null;
}

type AuthVerifyResult =
  | { ok: true; auth: AuthenticatedRequest }
  | { ok: false; reason: AuthFailureReason; message: string };

/** Coalesce parallel verifies from one page load. Role is always read fresh. */
const authInflight = new Map<string, Promise<AuthVerifyResult>>();
let authGeneration = 0;
const uidGeneration = new Map<string, number>();

/** Successful revocation checks are reused briefly so a page of API calls does not each hit Identity Toolkit. */
const TOKEN_CACHE_MS = 60_000;
const tokenCache = new Map<
  string,
  { expiresAt: number; uid: string; email?: string; tokenExp: number }
>();

function authStamp(uid: string): number {
  return authGeneration + (uidGeneration.get(uid) || 0);
}

function dropTokenCache(uid?: string) {
  if (!uid) {
    tokenCache.clear();
    return;
  }
  for (const [token, entry] of tokenCache) {
    if (entry.uid === uid) tokenCache.delete(token);
  }
}

/** Drop in-flight auth so a role or active-state change is not answered with the old profile. */
export function invalidateAuthCache(uid?: string) {
  if (!uid) {
    authGeneration += 1;
  } else {
    uidGeneration.set(uid, (uidGeneration.get(uid) || 0) + 1);
  }
  authInflight.clear();
  dropTokenCache(uid);
}

async function loadActiveProfile(uid: string): Promise<AuthVerifyResult | UserProfile> {
  const ref = adminDb.collection(COLLECTIONS.users).doc(uid);
  type Snap = Awaited<ReturnType<typeof ref.get>>;
  let snap: Snap | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stamp = authStamp(uid);
    snap = await ref.get();
    if (authStamp(uid) === stamp) break;
  }
  if (!snap?.exists) {
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
  if (!profile.role) {
    return {
      ok: false,
      reason: "profile_missing",
      message: "Your account is missing a role. Contact an administrator.",
    };
  }
  return profile;
}

async function verifyTokenUncached(token: string): Promise<AuthVerifyResult> {
  try {
    const now = Date.now();
    const cached = tokenCache.get(token);
    let uid: string;
    let email: string | undefined;
    if (cached && cached.expiresAt > now && cached.tokenExp > now) {
      uid = cached.uid;
      email = cached.email;
    } else {
      const decoded = await adminAuth.verifyIdToken(token, true);
      uid = decoded.uid;
      email = decoded.email;
      tokenCache.set(token, {
        expiresAt: now + TOKEN_CACHE_MS,
        uid,
        email,
        tokenExp: decoded.exp * 1000,
      });
      if (tokenCache.size > 200) {
        for (const [key, entry] of tokenCache) {
          if (entry.expiresAt <= Date.now()) tokenCache.delete(key);
        }
      }
    }
    const loaded = await loadActiveProfile(uid);
    if ("ok" in loaded) return loaded;

    const lockEmail = (email || loaded.email || "").trim();
    if (lockEmail) {
      try {
        const gate = await checkLoginAllowed(lockEmail);
        if (!gate.allowed) {
          return {
            ok: false,
            reason: "locked",
            message: gate.message || "Account is temporarily locked",
          };
        }
      } catch (lockErr) {
        console.error("[verifyAuth] lockout check failed:", lockErr);
        return {
          ok: false,
          reason: "invalid_token",
          message: "Could not verify account lock status. Try again.",
        };
      }
    }

    return {
      ok: true,
      auth: {
        uid,
        email: email || loaded.email,
        profile: loaded,
        role: loaded.role,
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

export async function verifyAuthDetailed(
  request: NextRequest
): Promise<AuthVerifyResult> {
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

  const token = header.slice(7);
  const pending = authInflight.get(token);
  if (pending) return pending;

  const job = verifyTokenUncached(token).finally(() => {
    authInflight.delete(token);
  });
  authInflight.set(token, job);
  return job;
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

export function authHttpStatus(reason: AuthFailureReason): number {
  if (reason === "admin_not_configured") return 503;
  if (reason === "locked") return 423;
  return 401;
}

export function unauthorized(message = "Unauthorized", status = 401) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function writeAuditLog(params: {
  actorId: string;
  actorEmail: string;
  actorName?: string;
  actorEmployeeCode?: string;
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
  const identity = await resolveAuditActor(params.actorId, params.actorName, params.actorEmployeeCode);
  const id = generateId("audit");
  await adminDb.collection(COLLECTIONS.auditLogs).doc(id).set(
    stripUndefined({
      id,
      timestamp: new Date().toISOString(),
      ...params,
      actorName: identity.name || params.actorName,
      actorEmployeeCode: identity.code || params.actorEmployeeCode,
    })
  );
  return id;
}

/** Name and employee / staff code for the audit Actor column. */
async function resolveAuditActor(
  actorId: string,
  name?: string,
  code?: string
): Promise<{ name?: string; code?: string }> {
  if (name && code) return { name, code };
  if (!actorId || actorId === "system") return { name, code };
  try {
    const snap = await adminDb.collection(COLLECTIONS.users).doc(actorId).get();
    if (!snap.exists) return { name, code };
    const data = snap.data() || {};
    return {
      name: name || stringField(data.displayName),
      code: code || stringField(data.username),
    };
  } catch {
    return { name, code };
  }
}

function stringField(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}
