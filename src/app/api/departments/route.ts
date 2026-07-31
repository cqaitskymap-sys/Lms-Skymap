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
import { createDepartmentSchema } from "@/lib/auth/department-schemas";
import { departmentIdFromCode } from "@/lib/departments/defaults";
import type { Department } from "@/types";

export async function GET(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  const denied = requirePermission(verified.auth, "departments:read");
  if (denied) return denied;

  const snap = await adminDb.collection(COLLECTIONS.departments).get();
  const departments = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as Department))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ success: true, departments });
}

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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createDepartmentSchema.safeParse(raw);
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
  const code = input.code.toUpperCase();
  const now = new Date().toISOString();
  const id = departmentIdFromCode(code);

  const existing = await adminDb
    .collection(COLLECTIONS.departments)
    .where("code", "==", code)
    .limit(1)
    .get();
  if (!existing.empty) {
    return NextResponse.json(
      { success: false, error: `Department code "${code}" already exists` },
      { status: 409 }
    );
  }

  const department: Department = {
    id,
    code,
    name: input.name,
    description: input.description || undefined,
    isActive: input.isActive ?? true,
    createdAt: now,
    updatedAt: now,
    createdBy: verified.auth.uid,
  };

  await adminDb.collection(COLLECTIONS.departments).doc(id).set(department);

  await writeAuditLog({
    actorId: verified.auth.uid,
    actorEmail: verified.auth.email,
    actorRole: verified.auth.role,
    action: "create",
    resourceType: "department",
    resourceId: id,
    description: `Created department ${code} — ${input.name}`,
    after: { code, name: input.name },
  });

  return NextResponse.json({ success: true, department });
}
