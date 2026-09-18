import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unauthorized, verifyAuthDetailed } from "@/lib/rbac/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { hasAnyPermission } from "@/lib/rbac/permissions";
import type { UserProfile, UserRole } from "@/types";

const DIRECTORY_ROLES: UserRole[] = [
  "super_admin",
  "hr",
  "qa",
  "department_head",
  "trainer",
];

/**
 * Minimal staff directory for trainer pickers / OJT notifications.
 * Does not expose emails or other account fields.
 */
export async function GET(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  if (
    !hasAnyPermission(verified.auth.role, [
      "trainers:read",
      "employees:write",
      "ojt:assign",
      "users:read",
    ])
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }

  const requested = (request.nextUrl.searchParams.get("roles") || "")
    .split(",")
    .map((role) => role.trim())
    .filter((role): role is UserRole => DIRECTORY_ROLES.includes(role as UserRole));
  const roles = requested.length > 0 ? [...new Set(requested)] : DIRECTORY_ROLES;

  try {
    const col = adminDb.collection(COLLECTIONS.users);
    const snap =
      roles.length === 1
        ? await col.where("role", "==", roles[0]).get()
        : await col.where("role", "in", roles).get();

    const users = snap.docs
      .map((doc) => {
        const data = doc.data() as UserProfile;
        return {
          id: data.id || doc.id,
          uid: data.uid || doc.id,
          displayName: data.displayName || "Staff",
          role: data.role,
          departmentId: data.departmentId,
          isActive: data.isActive !== false,
        } as UserProfile;
      })
      .filter((user) => user.isActive !== false && DIRECTORY_ROLES.includes(user.role))
      .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error("[users/directory]", err);
    return NextResponse.json(
      { success: false, error: "Could not load staff directory" },
      { status: 500 }
    );
  }
}
