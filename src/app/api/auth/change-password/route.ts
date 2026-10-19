import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { firebaseConfig } from "@/lib/firebase/config";
import { validatePassword } from "@/lib/auth/password-policy";

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
});

function wrongPasswordMessage(): string {
  return "Temporary password is incorrect. Use the password from the credentials card — re-issuing login credentials replaces the previous one.";
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 401 });
    }
    if (!isAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: "Password service is unavailable" },
        { status: 503 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7), true);
    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { success: false, error: "This account has no email address" },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = bodySchema.parse(await request.json());
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: "Choose a password that is different from the current one" },
        { status: 400 }
      );
    }

    const policy = validatePassword(newPassword, { email });
    if (!policy.valid) {
      return NextResponse.json(
        { success: false, error: policy.errors[0] || "Password does not meet policy" },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const signIn = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: origin.endsWith("/") ? origin : `${origin}/`,
        },
        body: JSON.stringify({
          email,
          password: currentPassword,
          returnSecureToken: false,
        }),
      }
    );
    if (!signIn.ok) {
      const failure = (await signIn.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      const code = failure.error?.message || "";
      if (code.includes("TOO_MANY_ATTEMPTS")) {
        return NextResponse.json(
          { success: false, error: "Too many attempts. Wait a few minutes and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json({ success: false, error: wrongPasswordMessage() }, { status: 400 });
    }

    await adminAuth.updateUser(decoded.uid, { password: newPassword });
    const now = new Date().toISOString();
    await adminDb.collection(COLLECTIONS.users).doc(decoded.uid).set(
      {
        mustChangePassword: false,
        passwordChangedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid password" }, { status: 400 });
    }
    console.error("[auth/change-password]", err);
    return NextResponse.json(
      { success: false, error: "Could not change password" },
      { status: 500 }
    );
  }
}
