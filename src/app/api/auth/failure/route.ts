import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  consumeRateLimit,
  recordLoginFailure,
  userExistsForEmail,
  writeActivityLogServer,
  writeLoginAudit,
} from "@/lib/auth/lockout-server";
import { LOCKOUT_POLICY } from "@/constants/auth";

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .refine((v) => v.includes("@"), "Email is required"),
});

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    if (!consumeRateLimit(`auth-fail:${ip}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    const json = await request.json();
    const { email } = bodySchema.parse(json);
    const normalized = email.toLowerCase();

    if (!consumeRateLimit(`auth-fail-email:${normalized}`, 8, 15 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    const ua = request.headers.get("user-agent") || undefined;

    // Do not lock accounts that do not exist (avoids filling lockout docs).
    if (!(await userExistsForEmail(normalized))) {
      return NextResponse.json({
        success: true,
        allowed: true,
        remainingAttempts: LOCKOUT_POLICY.maxFailedAttempts - 1,
        lockedUntil: null,
        message: "Invalid credentials.",
      });
    }

    const result = await recordLoginFailure(normalized);

    await writeLoginAudit({
      actorId: "anonymous",
      actorEmail: normalized,
      actorRole: "employee",
      action: "login",
      description: result.lockedUntil
        ? "Login failed — account locked"
        : "Login failed — invalid credentials",
      ipAddress: ip === "unknown" ? undefined : ip,
      userAgent: ua,
      success: false,
    });

    if (result.lockedUntil) {
      await writeActivityLogServer({
        userId: "anonymous",
        verb: "account_locked",
        summary: `Account locked for ${normalized} after failed attempts`,
        ipAddress: ip === "unknown" ? undefined : ip,
        userAgent: ua,
        metadata: { email: normalized },
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Could not record failure" }, { status: 500 });
  }
}
