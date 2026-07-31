import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  recordLoginFailure,
  writeActivityLogServer,
  writeLoginAudit,
} from "@/lib/auth/lockout-server";

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .refine((v) => v.includes("@"), "Email is required"),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const { email } = bodySchema.parse(json);
    const result = await recordLoginFailure(email);

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
    const ua = request.headers.get("user-agent") || undefined;

    await writeLoginAudit({
      actorId: "anonymous",
      actorEmail: email.toLowerCase(),
      actorRole: "employee",
      action: "login",
      description: result.lockedUntil
        ? "Login failed — account locked"
        : "Login failed — invalid credentials",
      ipAddress: ip,
      userAgent: ua,
      success: false,
    });

    if (result.lockedUntil) {
      await writeActivityLogServer({
        userId: "anonymous",
        verb: "account_locked",
        summary: `Account locked for ${email.toLowerCase()} after failed attempts`,
        ipAddress: ip,
        userAgent: ua,
        metadata: { email: email.toLowerCase() },
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
