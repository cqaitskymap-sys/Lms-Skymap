import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  unauthorized,
  verifyAuthDetailed,
  requirePermission,
} from "@/lib/rbac/middleware";
import { isOpenRouterConfigured, openRouterChat } from "@/lib/ai/openrouter";
import type { Permission } from "@/lib/rbac/permissions";

const bodySchema = z.object({
  kind: z.enum(["sop", "policy", "induction"]).default("sop"),
  title: z.string().min(2).max(300),
  description: z.string().max(4000).optional(),
  changeSummary: z.string().max(2000).optional(),
  content: z.string().max(8000).optional(),
  audience: z.enum(["employee", "trainer", "qa"]).default("employee"),
});

const KIND_PERMISSION: Record<"sop" | "policy" | "induction", Permission | null> = {
  sop: "sops:read",
  induction: "induction:read",
  /** Any signed-in user (first-login onboarding) */
  policy: null,
};

export async function POST(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
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

  const { kind, title, description, changeSummary, content, audience } = parsed.data;
  const permission = KIND_PERMISSION[kind];
  if (permission) {
    const denied = requirePermission(verified.auth, permission);
    if (denied) return denied;
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

  const prompts = buildPrompt({
    kind,
    title,
    description,
    changeSummary,
    content,
    audience,
  });

  const result = await openRouterChat({
    messages: [
      { role: "system", content: prompts.system },
      { role: "user", content: prompts.user },
    ],
    temperature: 0.3,
    maxTokens: 1800,
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
    explanation: result.content,
  });
}

function buildPrompt(input: {
  kind: "sop" | "policy" | "induction";
  title: string;
  description?: string;
  changeSummary?: string;
  content?: string;
  audience: string;
}) {
  if (input.kind === "policy") {
    return {
      system: `You help new pharmaceutical employees understand company policies in plain language.
Be accurate, concise, and practical. Structure with:
## In simple words
## What you must do
## What you must not do
Do not invent legal clauses. Remind them the official policy text is what they accept.`,
      user: `Policy: ${input.title}
${input.description ? `Summary: ${input.description}` : ""}
${input.content ? `Full text:\n${input.content}` : ""}

Explain this policy for a new joiner.`,
    };
  }

  if (input.kind === "induction") {
    return {
      system: `You are a pharma induction study coach for an LMS.
Write for a ${input.audience}. Structure with:
## What this module covers
## Why it matters on the shop floor / in QA
## Study checklist
## Exam focus tips
Keep it practical. Do not invent SOP numbers.`,
      user: `Induction module: ${input.title}
${input.description ? `Description: ${input.description}` : ""}
${input.content ? `Extra context:\n${input.content}` : ""}

Help the employee study this module.`,
    };
  }

  return {
    system: `You help pharmaceutical LMS users understand SOPs in plain language.
Write for a ${input.audience} audience. Be accurate, concise, and practical.
Structure the reply with short markdown sections:
## Plain-language summary
## Why it matters
## Key points to remember
## Common mistakes to avoid
Do not invent regulatory clause numbers. If context is thin, say what is known vs what to verify in the official PDF.`,
    user: `SOP title: ${input.title}
${input.description ? `Description: ${input.description}` : ""}
${input.changeSummary ? `Version change summary: ${input.changeSummary}` : ""}
${input.content ? `Extra context:\n${input.content}` : ""}

Explain this SOP for training purposes.`,
  };
}
