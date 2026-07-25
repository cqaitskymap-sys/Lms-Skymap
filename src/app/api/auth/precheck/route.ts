import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkLoginAllowed } from "@/lib/auth/lockout-server";

const bodySchema = z.object({
  /** Work email used for Firebase Auth (after username resolution on the client). */
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
    const result = await checkLoginAllowed(email);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Precheck failed" }, { status: 500 });
  }
}
