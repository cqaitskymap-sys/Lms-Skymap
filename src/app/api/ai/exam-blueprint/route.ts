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

const bodySchema = z.object({
  topic: z.string().min(3).max(400),
  context: z.string().max(6000).optional(),
  audience: z.enum(["induction", "sop_retrain", "general"]).default("general"),
});

export interface ExamBlueprint {
  title: string;
  description: string;
  questionCount: number;
  durationMinutes: number;
  passPercentage: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  randomizeFromBank: boolean;
  negativeMarkingEnabled: boolean;
  difficultyMix: { easy: number; medium: number; hard: number };
  suggestedTags: string[];
  notesForTrainer: string;
}

export async function POST(request: NextRequest) {
  const verified = await verifyAuthDetailed(request);
  if (!verified.ok) {
    const status = verified.reason === "admin_not_configured" ? 503 : 401;
    return unauthorized(verified.message, status);
  }

  const denied = requirePermission(verified.auth, "exams:write");
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

  const { topic, context, audience } = parsed.data;

  const result = await openRouterChat({
    messages: [
      {
        role: "system",
        content: `You design pharmaceutical LMS assessment blueprints.
Return ONLY JSON matching:
{"title":"string","description":"string","questionCount":number,"durationMinutes":number,"passPercentage":number,"maxAttempts":number,"shuffleQuestions":boolean,"shuffleOptions":boolean,"randomizeFromBank":boolean,"negativeMarkingEnabled":boolean,"difficultyMix":{"easy":number,"medium":number,"hard":number},"suggestedTags":["string"],"notesForTrainer":"string"}
Rules:
- questionCount 5-25
- durationMinutes ~1.5–2 min per question
- passPercentage typically 70-80 for GxP
- difficultyMix counts must sum to questionCount
- Keep titles clear for QA/training records`,
      },
      {
        role: "user",
        content: `Topic: ${topic}
Audience mode: ${audience}
${context ? `Context:\n${context}` : ""}

Create an exam blueprint.`,
      },
    ],
    temperature: 0.35,
    maxTokens: 1200,
    json: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  try {
    const draft = extractJsonObject<Partial<ExamBlueprint>>(result.content);
    const blueprint = normalizeBlueprint(draft, topic);
    return NextResponse.json({
      success: true,
      model: result.model,
      blueprint,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "AI returned unparseable exam blueprint" },
      { status: 502 }
    );
  }
}

function normalizeBlueprint(
  draft: Partial<ExamBlueprint>,
  topic: string
): ExamBlueprint {
  const questionCount = clampInt(draft.questionCount, 5, 25, 10);
  const durationMinutes = clampInt(
    draft.durationMinutes,
    10,
    180,
    Math.max(15, questionCount * 2)
  );
  const passPercentage = clampInt(draft.passPercentage, 50, 100, 70);
  const maxAttempts = clampInt(draft.maxAttempts, 1, 5, 2);

  let mix = {
    easy: clampInt(draft.difficultyMix?.easy, 0, questionCount, Math.floor(questionCount * 0.3)),
    medium: clampInt(
      draft.difficultyMix?.medium,
      0,
      questionCount,
      Math.floor(questionCount * 0.5)
    ),
    hard: clampInt(draft.difficultyMix?.hard, 0, questionCount, 0),
  };
  const mixSum = mix.easy + mix.medium + mix.hard;
  if (mixSum !== questionCount) {
    mix = {
      easy: Math.floor(questionCount * 0.3),
      medium: Math.floor(questionCount * 0.5),
      hard: 0,
    };
    mix.hard = questionCount - mix.easy - mix.medium;
  }

  return {
    title: (draft.title || `${topic} assessment`).slice(0, 200),
    description: (draft.description || `Competency check for: ${topic}`).slice(0, 800),
    questionCount,
    durationMinutes,
    passPercentage,
    maxAttempts,
    shuffleQuestions: draft.shuffleQuestions !== false,
    shuffleOptions: draft.shuffleOptions !== false,
    randomizeFromBank: draft.randomizeFromBank !== false,
    negativeMarkingEnabled: Boolean(draft.negativeMarkingEnabled),
    difficultyMix: mix,
    suggestedTags: Array.isArray(draft.suggestedTags)
      ? draft.suggestedTags.map(String).slice(0, 8)
      : ["ai-blueprint"],
    notesForTrainer: String(draft.notesForTrainer || "").slice(0, 1000),
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? Math.round(value) : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
