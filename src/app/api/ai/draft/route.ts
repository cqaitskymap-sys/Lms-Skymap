import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  unauthorized,
  verifyAuthDetailed,
  requirePermission,
} from "@/lib/rbac/middleware";
import {
  extractJsonObject,
  isOpenRouterConfigured,
  openRouterChat,
} from "@/lib/ai/openrouter";

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("jd"),
    jobTitle: z.string().min(2).max(200),
    department: z.string().max(120).optional(),
    notes: z.string().max(2000).optional(),
  }),
  z.object({
    kind: z.literal("tni"),
    jobTitle: z.string().min(2).max(200),
    responsibilities: z.string().min(10).max(4000),
    notes: z.string().max(2000).optional(),
  }),
]);

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

  const data = parsed.data;
  const permission = data.kind === "jd" ? "jd:write" : "tni:write";
  const denied = requirePermission(verified.auth, permission);
  if (denied) return denied;

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

  if (data.kind === "jd") {
    const result = await openRouterChat({
      messages: [
        {
          role: "system",
          content: `You draft pharmaceutical job descriptions for an LMS.
Return ONLY JSON:
{"responsibilities":["..."],"qualifications":["..."],"skills":["..."]}
Keep items short, GMP-aware, and role-appropriate. 4-8 responsibilities, 2-5 qualifications, 3-6 skills.`,
        },
        {
          role: "user",
          content: `Job title: ${data.jobTitle}
${data.department ? `Department: ${data.department}` : ""}
${data.notes ? `Notes: ${data.notes}` : ""}`,
        },
      ],
      temperature: 0.4,
      maxTokens: 1500,
      json: true,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status && result.status >= 400 ? result.status : 502 }
      );
    }

    try {
      const draft = extractJsonObject<{
        responsibilities?: string[];
        qualifications?: string[];
        skills?: string[];
      }>(result.content);
      return NextResponse.json({
        success: true,
        model: result.model,
        draft: {
          responsibilities: (draft.responsibilities || []).map(String),
          qualifications: (draft.qualifications || []).map(String),
          skills: (draft.skills || []).map(String),
        },
      });
    } catch {
      return NextResponse.json(
        { success: false, error: "AI returned unparseable JD draft" },
        { status: 502 }
      );
    }
  }

  const result = await openRouterChat({
    messages: [
      {
        role: "system",
        content: `You create Training Need Identification (TNI) items for pharma roles.
Return ONLY JSON:
{"needs":[{"topic":"string","priority":"low|medium|high","rationale":"string"}]}
Propose 3-6 concrete training topics mapped from responsibilities. Prefer SOP/GMP themes.`,
      },
      {
        role: "user",
        content: `Job title: ${data.jobTitle}
Responsibilities:
${data.responsibilities}
${data.notes ? `Notes: ${data.notes}` : ""}`,
      },
    ],
    temperature: 0.4,
    maxTokens: 1800,
    json: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  try {
    const draft = extractJsonObject<{
      needs?: Array<{ topic?: string; priority?: string; rationale?: string }>;
    }>(result.content);
    const needs = (draft.needs || [])
      .filter((n) => n?.topic)
      .map((n) => ({
        topic: String(n.topic),
        priority: ["low", "medium", "high"].includes(String(n.priority))
          ? String(n.priority)
          : "medium",
        rationale: String(n.rationale || ""),
      }));
    return NextResponse.json({ success: true, model: result.model, needs });
  } catch {
    return NextResponse.json(
      { success: false, error: "AI returned unparseable TNI draft" },
      { status: 502 }
    );
  }
}
