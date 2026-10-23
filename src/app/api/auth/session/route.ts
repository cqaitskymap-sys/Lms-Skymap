import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  SESSION_TEMPORARY_MAX_AGE_MS,
} from "@/constants/auth";
import { adminAuth, isAdminConfigured } from "@/lib/firebase/admin";
import {
  checkLoginAllowed,
  recordLoginSuccess,
  updateUserLastLogin,
  writeActivityLogServer,
  writeLoginAudit,
} from "@/lib/auth/lockout-server";
import { COLLECTIONS } from "@/lib/firebase/client";
import { adminDb } from "@/lib/firebase/admin";

function cookieOptions(rememberMe = true) {
  const expiresIn = rememberMe ? SESSION_MAX_AGE_MS : SESSION_TEMPORARY_MAX_AGE_MS;
  return {
    name: AUTH_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    // No maxAge means a browser-session cookie. A 12h maxAge would survive a restart.
    ...(rememberMe ? { maxAge: expiresIn / 1000 } : {}),
  };
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
      if (process.env.AUTH_ENFORCE_SESSION_COOKIE === "true") {
        return NextResponse.json(
          { success: false, session: false, error: "Session service is unavailable" },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: true,
        session: false,
        message: "Admin SDK not configured; client session only",
      });
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const lockEmail = decoded.email?.trim();
    if (lockEmail) {
      try {
        const gate = await checkLoginAllowed(lockEmail);
        if (!gate.allowed) {
          return NextResponse.json(
            { success: false, error: gate.message || "Account is temporarily locked" },
            { status: 423 }
          );
        }
      } catch (lockErr) {
        console.error("[auth/session] lockout check failed:", lockErr);
        return NextResponse.json(
          { success: false, error: "Could not verify account lock status. Try again." },
          { status: 503 }
        );
      }
    }

    let role = "";
    let email = decoded.email || "";
    try {
      const snap = await adminDb.collection(COLLECTIONS.users).doc(decoded.uid).get();
      if (!snap.exists) {
        return NextResponse.json(
          {
            success: false,
            error: "No user profile is linked to this account. Contact an administrator.",
          },
          { status: 403 }
        );
      }
      const data = snap.data()!;
      role = typeof data.role === "string" ? data.role : "";
      email = (data.email as string) || email;
      if (!role) {
        return NextResponse.json(
          { success: false, error: "Your account is missing a role. Contact an administrator." },
          { status: 403 }
        );
      }
      if (data.isActive === false) {
        return NextResponse.json(
          { success: false, error: "Account is deactivated. Contact HR." },
          { status: 403 }
        );
      }
    } catch (profileErr) {
      console.error("[auth/session] profile read failed:", profileErr);
      return NextResponse.json(
        { success: false, error: "Could not load your account. Try again." },
        { status: 503 }
      );
    }

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

    await Promise.all([
      recordLoginSuccess(email || decoded.uid),
      updateUserLastLogin(decoded.uid, ip),
      writeLoginAudit({
        actorId: decoded.uid,
        actorEmail: email || decoded.uid,
        actorRole: role,
        action: "login",
        description: "User signed in successfully",
        ipAddress: ip,
        userAgent: ua,
        success: true,
      }),
      writeActivityLogServer({
        userId: decoded.uid,
        verb: "login_success",
        summary: "Signed in",
        ipAddress: ip,
        userAgent: ua,
      }),
    ]);

    const response = NextResponse.json({ success: true, session: true });
    response.cookies.set({ ...cookieOptions(rememberMe), value: sessionCookie });
    return response;
  } catch (err) {
    console.error("[auth/session] POST failed:", err);
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
      const decoded = await adminAuth.verifySessionCookie(session, false);
      let role = "employee";
      try {
        const snap = await adminDb.collection(COLLECTIONS.users).doc(decoded.uid).get();
        if (snap.exists) {
          role = (snap.data()?.role as string) || role;
        }
      } catch {
        /* profile optional for logout audit */
      }
      await Promise.all([
        writeLoginAudit({
          actorId: decoded.uid,
          actorEmail: decoded.email || decoded.uid,
          actorRole: role,
          action: "logout",
          description: "User signed out",
          ipAddress: ip,
          userAgent: ua,
          success: true,
        }),
        writeActivityLogServer({
          userId: decoded.uid,
          verb: "logout",
          summary: "Signed out",
          ipAddress: ip,
          userAgent: ua,
        }),
      ]);
    } catch {
      /* cookie already invalid */
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...cookieOptions(true), value: "", maxAge: 0 });
  return response;
}
