import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/constants/auth";

/**
 * Edge middleware — gate /dashboard behind a session cookie when present.
 * Full RBAC is enforced in AuthGuard + server actions (Admin SDK).
 *
 * When Admin SDK is not configured in production builds, cookie may be absent;
 * client AuthGuard remains the fallback so local/demo still works.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const session = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const enforceCookie = process.env.AUTH_ENFORCE_SESSION_COOKIE === "true";

  if (enforceCookie && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Soft gate: if cookie exists and request is login page redirect handled elsewhere
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
