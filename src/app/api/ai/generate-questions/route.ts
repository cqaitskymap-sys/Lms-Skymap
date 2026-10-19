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
  providerErrorStatus,
} from "@/lib/ai/openrouter";
import { normalizeQuestion, type QuestionDraftInput } from "@/lib/ai/normalize-question";

const bodySchema = z.object({
  topic: z.string().trim().min(1, "Topic is required").max(500),
  context: z.string().max(8000).optional().or(z.literal("")),
  count: z.coerce.number().int().min(1).max(10).default(5),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  types: z
    .array(z.enum(["mcq", "true_false", "multi_select", "scenario"]))
    .min(1, "Select at least one question type")
    .default(["mcq", "true_false"]),
});

export async function POST(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  const denied = requirePermission(verified.auth, "questions:write");
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const message =
      Object.values(fieldErrors)
        .flat()
        .filter(Boolean)
        .join("; ") || "Validation failed";
    return NextResponse.json(
      {
        success: false,
        error: message,
        details: fieldErrors,
      },
      { status: 400 }
    );
  }

  const { topic, context, count, difficulty, types } = parsed.data;

  const system = `You are a pharmaceutical GMP / GxP training assessment writer for an LMS.
Generate assessment questions suitable for employee competency checks.
Rules:
- Return ONLY valid JSON matching this schema:
{"questions":[{"text":"string","type":"mcq|true_false|multi_select|scenario","difficulty":"easy|medium|hard","options":[{"text":"string","isCorrect":boolean}],"explanation":"string","marks":number,"tags":["string"],"scenario":{"title":"string","narrative":"string"}}]}
- For mcq: exactly 4 options, exactly 1 correct.
- For true_false: exactly 2 options "True" and "False", exactly 1 correct.
- For multi_select: 4 options, 2+ correct.
- For scenario: include scenario.narrative and a clear question text with options (mcq-style, 4 options, 1 correct).
- Marks: easy=1, medium=2, hard=3.
- Keep language clear for manufacturing / QA / HR staff.
- Do not invent regulatory citations you are unsure about; prefer procedural understanding.`;

  const user = `Topic: ${topic}
Count: ${count}
Difficulty preference: ${difficulty}
Allowed types: ${types.join(", ")}
${context ? `Additional SOP / training context:\n${context}` : ""}

Generate ${count} questions now.`;

  const result = await openRouterChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.5,
    maxTokens: 4096,
    json: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: providerErrorStatus(result.status) }
    );
  }

  let draft: { questions?: QuestionDraftInput[] };
  try {
    draft = extractJsonObject<{ questions?: QuestionDraftInput[] }>(result.content);
  } catch {
    return NextResponse.json(
      { success: false, error: "AI returned unparseable JSON" },
      { status: 502 }
    );
  }

  const allowedTypes = new Set(types);
  const questions = (draft.questions || [])
    .filter((q) => q && typeof q.text === "string" && Array.isArray(q.options))
    .map((q) => normalizeQuestion(q, allowedTypes, difficulty))
    .filter(Boolean)
    .slice(0, count);

  if (questions.length === 0) {
    return NextResponse.json(
      { success: false, error: "AI did not return usable questions" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    model: result.model,
    questions,
  });
}

