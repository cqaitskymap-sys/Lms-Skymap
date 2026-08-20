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
  type OpenRouterContentPart,
} from "@/lib/ai/openrouter";
import { normalizeQuestion, type QuestionDraftInput } from "@/lib/ai/normalize-question";

export const maxDuration = 60;

const bodySchema = z.object({
  fileName: z.string().max(200).optional(),
  paperText: z.string().max(40_000).optional().or(z.literal("")),
  images: z.array(z.string().startsWith("data:image/")).max(6).optional(),
  maxQuestions: z.coerce.number().int().min(1).max(25).default(20),
});

const ALLOWED_TYPES = new Set(["mcq", "true_false", "multi_select", "scenario"]);

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
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const paperText = parsed.data.paperText?.trim() || "";
  const images = parsed.data.images || [];
  if (!paperText && images.length === 0) {
    return NextResponse.json(
      { success: false, error: "No readable content found in the PDF" },
      { status: 400 }
    );
  }

  const maxQuestions = parsed.data.maxQuestions;
  const fileName = parsed.data.fileName || "question-paper.pdf";

  const system = `You extract assessment questions from an existing question paper for a pharmaceutical LMS.
Rules:
- Return ONLY valid JSON:
{"questions":[{"text":"string","type":"mcq|true_false|multi_select|scenario","difficulty":"easy|medium|hard","options":[{"text":"string","isCorrect":boolean}],"explanation":"string","marks":number,"tags":["string"],"scenario":{"title":"string","narrative":"string"}}]}
- EXTRACT questions that already appear in the paper. Do not invent new questions or topics.
- Preserve original wording as closely as possible.
- For mcq: keep the paper's options (usually 4), exactly 1 correct if the key is given.
- For true_false: options must be "True" and "False".
- For multi_select: mark every option the paper marks as correct.
- If an answer key / highlighted / ticked answer is present, set isCorrect accordingly.
- If no answer is given, still extract options and set the most likely labelled answer; if unknown, mark the first option correct and put "Answer not printed on paper — verify" in explanation.
- Marks: use printed marks if shown, else easy=1, medium=2, hard=3.
- Skip instructions, cover page, and invigilator notes.
- Maximum ${maxQuestions} questions.`;

  const userParts: OpenRouterContentPart[] = [
    {
      type: "text",
      text: `File: ${fileName}
Extract up to ${maxQuestions} questions from this paper.

${paperText ? `Extracted text:\n${paperText}` : "Text layer was empty (likely a scanned paper). Read the page images."}`,
    },
    ...images.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ];

  const result = await openRouterChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: userParts },
    ],
    temperature: 0.2,
    maxTokens: 8192,
    json: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status && result.status >= 400 ? result.status : 502 }
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

  const questions = (draft.questions || [])
    .filter((q) => q && typeof q.text === "string" && Array.isArray(q.options))
    .map((q) =>
      normalizeQuestion(q, ALLOWED_TYPES, "mixed", ["imported-from-paper"])
    )
    .filter(Boolean)
    .slice(0, maxQuestions);

  if (questions.length === 0) {
    return NextResponse.json(
      { success: false, error: "No usable questions could be read from this paper" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    model: result.model,
    scanned: images.length > 0,
    questions,
  });
}
