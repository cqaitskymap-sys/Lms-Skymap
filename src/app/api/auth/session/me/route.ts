import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/constants/auth";
import { adminAuth } from "@/lib/firebase/admin";

function adminReady() {
  return Boolean(
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

/**
 * Lightweight session probe for middleware / client health checks.
 */
export async function GET(request: NextRequest) {
  const session = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  if (!adminReady()) {
    // Cookie present but cannot verify — treat as opaque presence signal
    return NextResponse.json({ authenticated: true, verified: false });
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return NextResponse.json({
      authenticated: true,
      verified: true,
      uid: decoded.uid,
      email: decoded.email,
    });
  } catch {
    const res = NextResponse.json({ authenticated: false });
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: "",
      maxAge: 0,
      path: "/",
    });
    return res;
  }
}
