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
import {
  createAdminUserSchema,
  PROVISIONABLE_ROLES,
  resolveStaffAuthEmail,
} from "@/lib/auth/user-admin-schemas";
import { normalizeAllowedModules } from "@/lib/rbac/modules";
import { generateTemporaryPassword } from "@/lib/onboarding/temp-password";
import type { UserProfile } from "@/types";

const STAFF_ROLES = ["super_admin", ...PROVISIONABLE_ROLES] as const;

export async function GET(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  const denied = requirePermission(verified.auth, "users:read");
  if (denied) return denied;

  if (verified.auth.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Only Super Admin can manage staff accounts" },
      { status: 403 }
    );
  }

  const snap = await adminDb.collection(COLLECTIONS.users).get();
  const users = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as UserProfile))
    .filter((u) => STAFF_ROLES.includes(u.role as (typeof STAFF_ROLES)[number]))
    .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

  return NextResponse.json({ success: true, users });
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return unauthorized(
      "Firebase Admin SDK is required to create accounts. Configure Admin credentials in .env.local and restart the dev server.",
      503
    );
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
      { success: false, error: "Only Super Admin can create staff accounts" },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createAdminUserSchema.safeParse(raw);
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
  const username = input.username;
  const email = resolveStaffAuthEmail(input.email, username);
  const allowedModules = normalizeAllowedModules(input.role, input.allowedModules);
  const now = new Date().toISOString();
  const ip = request.headers.get("x-forwarded-for") || undefined;
  const ua = request.headers.get("user-agent") || undefined;

  const existingByUsername = await adminDb
    .collection(COLLECTIONS.users)
    .where("username", "==", username)
    .limit(1)
    .get();
  if (!existingByUsername.empty) {
    return NextResponse.json(
      { success: false, error: "A user with this staff ID already exists" },
      { status: 409 }
    );
  }

  const existingUserSnap = await adminDb
    .collection(COLLECTIONS.users)
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!existingUserSnap.empty) {
    return NextResponse.json(
      { success: false, error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  try {
    const existingAuth = await adminAuth.getUserByEmail(email);
    if (existingAuth) {
      return NextResponse.json(
        { success: false, error: "An authentication account already exists for this login" },
        { status: 409 }
      );
    }
  } catch {
    /* not found — expected */
  }

  const temporaryPassword = generateTemporaryPassword();
  let uid: string;

  try {
    const created = await adminAuth.createUser({
      email,
      password: temporaryPassword,
      displayName: input.displayName,
      emailVerified: false,
      disabled: false,
    });
    uid = created.uid;

    const claims: Record<string, string> = { role: input.role };
    if (input.departmentId) claims.departmentId = input.departmentId;
    await adminAuth.setCustomUserClaims(uid, claims);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create authentication account",
      },
      { status: 500 }
    );
  }

  const userProfile: UserProfile = {
    id: uid,
    uid,
    email,
    username,
    displayName: input.displayName,
    role: input.role,
    allowedModules,
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    isActive: true,
    mustChangePassword: true,
    createdAt: now,
    updatedAt: now,
    createdBy: verified.auth.uid,
  };

  await adminDb.collection(COLLECTIONS.users).doc(uid).set(userProfile);

  if (input.role === "department_head" && input.departmentId) {
    await adminDb.collection(COLLECTIONS.departments).doc(input.departmentId).set(
      { headUserId: uid, updatedAt: now },
      { merge: true }
    );
  }

  await writeAuditLog({
    actorId: verified.auth.uid,
    actorEmail: verified.auth.email,
    actorRole: verified.auth.role,
    action: "create",
    resourceType: "user",
    resourceId: uid,
    description: `Provisioned ${input.role} account for ${input.displayName} (${username})`,
    after: {
      role: input.role,
      username,
      email,
      departmentId: input.departmentId || null,
      allowedModules,
    },
    ipAddress: ip,
    userAgent: ua,
  });

  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";

  return NextResponse.json({
    success: true,
    user: userProfile,
    credentials: {
      username,
      email,
      temporaryPassword,
      loginUrl: origin ? `${origin}/login` : "/login",
      oneTime: true,
    },
  });
}
