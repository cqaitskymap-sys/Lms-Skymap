import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  SESSION_TEMPORARY_MAX_AGE_MS,
} from "@/constants/auth";
import { adminAuth, isAdminConfigured } from "@/lib/firebase/admin";
import {
  recordLoginSuccess,
  updateUserLastLogin,
  writeActivityLogServer,
  writeLoginAudit,
} from "@/lib/auth/lockout-server";
import { COLLECTIONS } from "@/lib/firebase/client";
import { adminDb } from "@/lib/firebase/admin";

function cookieOptions(rememberMe = true) {
  const base = {
    name: AUTH_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  if (!rememberMe) return base;
  return { ...base, maxAge: SESSION_MAX_AGE_MS / 1000 };
}

/**
 * Create a Firebase session cookie from a client ID token.
 * Also clears lockout, updates lastLoginAt, and writes login audit.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
    const ua = request.headers.get("user-agent") || undefined;

    let rememberMe = true;
    try {
      const body = (await request.json()) as { rememberMe?: unknown };
      if (typeof body?.rememberMe === "boolean") rememberMe = body.rememberMe;
    } catch {
      /* no body — keep persistent session (legacy callers) */
    }
    const expiresIn = rememberMe ? SESSION_MAX_AGE_MS : SESSION_TEMPORARY_MAX_AGE_MS;

    if (!isAdminConfigured()) {
      // Demo / local without Admin SDK — acknowledge login side-effects best-effort
      return NextResponse.json({
        success: true,
        session: false,
        message: "Admin SDK not configured; client session only",
      });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    let sessionCookie: string;
    try {
      sessionCookie = await adminAuth.createSessionCookie(idToken, {
        expiresIn,
      });
    } catch (err) {
      // Common when client refreshes an ID token long after sign-in —
      // createSessionCookie requires a recent authentication event.
      console.warn("[auth/session] createSessionCookie rejected:", err);
      return NextResponse.json(
        {
          success: false,
          error: "Session cookie requires a recent sign-in. Please sign in again.",
          code: "session_cookie_requires_recent_signin",
        },
        { status: 401 }
      );
    }

    let role = "employee";
    let email = decoded.email || "";
    try {
      const snap = await adminDb.collection(COLLECTIONS.users).doc(decoded.uid).get();
      if (snap.exists) {
        const data = snap.data()!;
        role = (data.role as string) || role;
        email = (data.email as string) || email;
        if (data.isActive === false) {
          return NextResponse.json(
            { success: false, error: "Account is deactivated. Contact HR." },
            { status: 403 }
          );
        }
      }
    } catch {
      /* profile optional for cookie */
    }

    await recordLoginSuccess(email || decoded.uid);
    await updateUserLastLogin(decoded.uid, ip);
    await writeLoginAudit({
      actorId: decoded.uid,
      actorEmail: email || decoded.uid,
      actorRole: role,
      action: "login",
      description: "User signed in successfully",
      ipAddress: ip,
      userAgent: ua,
      success: true,
    });
    await writeActivityLogServer({
      userId: decoded.uid,
      verb: "login_success",
      summary: "Signed in",
      ipAddress: ip,
      userAgent: ua,
    });

    const response = NextResponse.json({ success: true, session: true });
    response.cookies.set({ ...cookieOptions(rememberMe), value: sessionCookie });
    return response;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 401 });
  }
}

/** Clear session cookie (logout). */
export async function DELETE(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const ua = request.headers.get("user-agent") || undefined;
  const session = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (session && isAdminConfigured()) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true);
      await writeLoginAudit({
        actorId: decoded.uid,
        actorEmail: decoded.email || decoded.uid,
        actorRole: "employee",
        action: "logout",
        description: "User signed out",
        ipAddress: ip,
        userAgent: ua,
        success: true,
      });
      await writeActivityLogServer({
        userId: decoded.uid,
        verb: "logout",
        summary: "Signed out",
        ipAddress: ip,
        userAgent: ua,
      });
    } catch {
      /* cookie already invalid */
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...cookieOptions(true), value: "", maxAge: 0 });
  return response;
}
