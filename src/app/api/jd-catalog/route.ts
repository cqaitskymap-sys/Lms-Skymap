import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { normalizeJdCatalogDraft, type JdMasterRecord } from "@/lib/jd/catalog-master";
import type { JdCatalogSnapshot } from "@/lib/jd/responsibility-catalog";
import { unauthorized, verifyAuthDetailed, requirePermission, authHttpStatus } from "@/lib/rbac/middleware";

function asRecord(id: string, data: Record<string, unknown>): JdMasterRecord {
  return {
    id,
    departmentId: typeof data.departmentId === "string" ? data.departmentId : id,
    sections: Array.isArray(data.sections) ? data.sections : [],
    designations: Array.isArray(data.designations) ? data.designations : [],
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : undefined,
  };
}

export async function GET(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = authHttpStatus(verified.reason);
    return unauthorized(verified.message, status);
  }
  const denied = requirePermission(verified.auth, "jd:read");
  if (denied) return denied;

  try {
    const snap = await adminDb.collection(COLLECTIONS.jdCatalog).get();
    const masters = snap.docs.map((row) =>
      asRecord(row.id, row.data() as Record<string, unknown>)
    );
    return NextResponse.json({ success: true, masters });
  } catch (err) {
    console.error("[jd-catalog] list failed:", err);
    return NextResponse.json({ success: false, error: "Could not load JD lists" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isAdminConfigured()) {
    return unauthorized("Firebase Admin SDK is not configured.", 503);
  }
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = authHttpStatus(verified.reason);
    return unauthorized(verified.message, status);
  }
  if (verified.auth.role !== "super_admin") {
    return NextResponse.json({ success: false, error: "Only Admin can save these lists" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const departmentId = typeof body.departmentId === "string" ? body.departmentId.trim() : "";
  if (!departmentId) {
    return NextResponse.json({ success: false, error: "Department is required" }, { status: 400 });
  }

  try {
    const normalized = normalizeJdCatalogDraft({
      sections: Array.isArray(body.sections)
        ? (body.sections as JdCatalogSnapshot["sections"])
        : [],
      designations: Array.isArray(body.designations)
        ? (body.designations as JdCatalogSnapshot["designations"])
        : [],
    });
    const record: JdMasterRecord = {
      id: departmentId,
      departmentId,
      sections: normalized.sections,
      designations: normalized.designations,
      updatedAt: new Date().toISOString(),
      updatedBy: verified.auth.uid,
    };
    await adminDb.collection(COLLECTIONS.jdCatalog).doc(departmentId).set(record);
    return NextResponse.json({ success: true, master: record });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save JD lists";
    const status = /listed twice|required/i.test(message) ? 400 : 500;
    if (status === 500) console.error("[jd-catalog] save failed:", err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminConfigured()) {
    return unauthorized("Firebase Admin SDK is not configured.", 503);
  }
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = authHttpStatus(verified.reason);
    return unauthorized(verified.message, status);
  }
  if (verified.auth.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Only Admin can change these lists" },
      { status: 403 }
    );
  }
  const departmentId = request.nextUrl.searchParams.get("departmentId")?.trim() || "";
  if (!departmentId) {
    return NextResponse.json({ success: false, error: "Department is required" }, { status: 400 });
  }
  await adminDb.collection(COLLECTIONS.jdCatalog).doc(departmentId).delete();
  return NextResponse.json({ success: true });
}
