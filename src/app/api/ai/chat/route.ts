import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  unauthorized,
  verifyAuthDetailed,
} from "@/lib/rbac/middleware";
import { isOpenRouterConfigured, openRouterChat } from "@/lib/ai/openrouter";
import { DEFAULT_COMPANY_POLICIES } from "@/lib/onboarding/policies";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(messageSchema).max(12).optional(),
  contextNote: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "AI is not configured. Add OPENROUTER_API_KEY to .env.local and restart the dev server.",
      },
      { status: 503 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { message, history = [], contextNote } = parsed.data;
  const name = verified.auth.profile.displayName || "Learner";
  const role = verified.auth.role;

  const policyBrief = DEFAULT_COMPANY_POLICIES.map(
    (p) => `- ${p.title}: ${p.summary}`
  ).join("\n");

  const system = `You are PharmaLMS Training Assistant for pharmaceutical GMP / GxP learning.
User: ${name} (role: ${role}).
Help with induction study, SOP understanding, assessments prep, and company policy awareness.
Be concise, practical, and encouraging. Use plain language.
If asked for official legal/regulatory citations you are unsure about, say to check the approved SOP/PDF or ask QA/HR.
Never invent employee grades, certificates, or that training was completed.
Company policy overview:
${policyBrief}
${contextNote ? `Extra session context:\n${contextNote}` : ""}`;

  const result = await openRouterChat({
    messages: [
      { role: "system", content: system },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ],
    temperature: 0.4,
    maxTokens: 900,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  return NextResponse.json({
    success: true,
    model: result.model,
    reply: result.content,
  });
}
