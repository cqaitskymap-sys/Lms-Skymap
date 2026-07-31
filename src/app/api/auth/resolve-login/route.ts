import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { resolveLoginSchema } from "@/lib/auth/onboarding-schemas";

function looksLikeEmail(value: string) {
  return value.includes("@") && value.includes(".");
}

/**
 * Resolve login identifier (employee code / username / email) → Auth email.
 * When Admin SDK is unavailable, returns resolved:false so the client can look up via Firestore.
 */
export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = resolveLoginSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid identifier" }, { status: 400 });
  }

  const identifier = parsed.data.identifier.trim();
  const lower = identifier.toLowerCase();

  if (looksLikeEmail(identifier)) {
    return NextResponse.json({
      success: true,
      data: { email: lower, resolved: true },
    });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({
      success: true,
      data: { email: null, resolved: false, code: identifier.toUpperCase() },
    });
  }

  const code = identifier.toUpperCase();

  try {
    const byUsername = await adminDb
      .collection(COLLECTIONS.users)
      .where("username", "==", code)
      .limit(1)
      .get();

    if (!byUsername.empty) {
      const u = byUsername.docs[0]!.data();
      if (u.isActive === false) {
        return NextResponse.json(
          { success: false, error: "Account is deactivated. Contact HR." },
          { status: 403 }
        );
      }
      return NextResponse.json({
        success: true,
        data: { email: String(u.email).toLowerCase(), resolved: true },
      });
    }

    const byCode = await adminDb
      .collection(COLLECTIONS.employees)
      .where("employeeCode", "==", code)
      .limit(1)
      .get();

    if (!byCode.empty) {
      const e = byCode.docs[0]!.data();
      return NextResponse.json({
        success: true,
        data: { email: String(e.email).toLowerCase(), resolved: true },
      });
    }
  } catch (err) {
    console.error("[resolve-login]", err);
    return NextResponse.json({
      success: true,
      data: { email: null, resolved: false, code },
    });
  }

  // Not found — do not invent a fake email (that breaks precheck / Auth)
  return NextResponse.json({
    success: false,
    error: "No account found for that username. Use your work email or contact HR.",
  }, { status: 404 });
}
