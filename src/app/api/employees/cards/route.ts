import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unauthorized, verifyAuthDetailed, authHttpStatus } from "@/lib/rbac/middleware";
import { hasPermission } from "@/lib/rbac/permissions";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitName(data: Record<string, unknown>): { firstName: string; lastName: string } {
  const firstName = text(data.firstName);
  const lastName = text(data.lastName);
  if (firstName || lastName) return { firstName, lastName };
  const full = text(data.displayName) || text(data.name) || text(data.employeeName);
  if (!full) return { firstName: "", lastName: "" };
  const parts = full.split(/\s+/);
  return { firstName: parts.shift() || "", lastName: parts.join(" ") };
}

/**
 * Name, code, joining date and reporting manager for JD print.
 * The client employee list can miss a record, and some readers cannot open the employee document directly.
 */
export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return unauthorized("Firebase Admin SDK is not configured.", 503);
  }

  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    return unauthorized(
      verified.message,
      authHttpStatus(verified.reason)
    );
  }
  if (
    !hasPermission(verified.auth.role, "employees:read") &&
    !hasPermission(verified.auth.role, "jd:read")
  ) {
    return NextResponse.json(
      { success: false, error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawIds = Array.isArray((body as { ids?: unknown }).ids)
    ? (body as { ids: unknown[] }).ids
    : [];
  const ids = [
    ...new Set(
      rawIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => /^[A-Za-z0-9_-]{1,80}$/.test(id))
    ),
  ].slice(0, 40);
  if (!ids.length) {
    return NextResponse.json({ success: true, employees: [] });
  }

  try {
    const col = adminDb.collection(COLLECTIONS.employees);
    const snaps = await Promise.all(ids.map((id) => col.doc(id).get()));
    const employees = snaps
      .filter((snap) => snap.exists)
      .map((snap) => {
        const data = (snap.data() || {}) as Record<string, unknown>;
        const { firstName, lastName } = splitName(data);
        return {
          id: snap.id,
          firstName,
          lastName,
          employeeCode: text(data.employeeCode) || text(data.username),
          dateOfJoining: text(data.dateOfJoining),
          designation: text(data.designation),
          departmentId: text(data.departmentId) || undefined,
          departmentName: text(data.departmentName) || undefined,
          reportingManagerId: text(data.reportingManagerId) || undefined,
          reportingManagerName: text(data.reportingManagerName),
        };
      });

    const managerIds = [
      ...new Set(
        employees
          .filter((row) => !row.reportingManagerName && row.reportingManagerId)
          .map((row) => row.reportingManagerId as string)
      ),
    ];
    if (managerIds.length) {
      const managers = await Promise.all(managerIds.map((id) => col.doc(id).get()));
      const names = new Map<string, string>();
      for (const snap of managers) {
        if (!snap.exists) continue;
        const { firstName, lastName } = splitName((snap.data() || {}) as Record<string, unknown>);
        const name = `${firstName} ${lastName}`.trim();
        if (name) names.set(snap.id, name);
      }
      for (const row of employees) {
        if (!row.reportingManagerName && row.reportingManagerId) {
          row.reportingManagerName = names.get(row.reportingManagerId) || "";
        }
      }
    }

    return NextResponse.json({ success: true, employees });
  } catch (err) {
    console.error("[employees/cards]", err);
    return NextResponse.json(
      { success: false, error: "Could not load employee names" },
      { status: 500 }
    );
  }
}
