/**
 * Client helpers for OpenRouter-backed AI routes.
 */

import { auth } from "@/lib/firebase/client";
import type { QuestionDifficulty, QuestionOption, QuestionType } from "@/types";

export interface AiGeneratedQuestion {
  text: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  options: QuestionOption[];
  explanation?: string;
  marks: number;
  tags: string[];
  scenario?: { title?: string; narrative: string };
}

export interface GenerateQuestionsInput {
  topic: string;
  context?: string;
  count?: number;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
  types?: Array<"mcq" | "true_false" | "multi_select" | "scenario">;
}

export type ExplainKind = "sop" | "policy" | "induction";

export interface ExplainInput {
  kind?: ExplainKind;
  title: string;
  description?: string;
  changeSummary?: string;
  content?: string;
  audience?: "employee" | "trainer" | "qa";
}

/** @deprecated Prefer ExplainInput + explainWithAi */
export type ExplainSopInput = ExplainInput;

export interface JdDraft {
  responsibilities: string[];
  qualifications: string[];
  skills: string[];
}

export interface TniNeedDraft {
  topic: string;
  priority: string;
  rationale: string;
}

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in");
  const token = await user.getIdToken(true);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string;
      details?: Record<string, string[] | undefined>;
    };
    if (body.details) {
      const fromFields = Object.values(body.details)
        .flat()
        .filter((m): m is string => Boolean(m));
      if (fromFields.length) return fromFields.join("; ");
    }
    return body.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function generateQuestionsWithAi(
  input: GenerateQuestionsInput
): Promise<{ questions: AiGeneratedQuestion[]; model: string }> {
  const res = await fetch("/api/ai/generate-questions", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as {
    success: boolean;
    questions: AiGeneratedQuestion[];
    model: string;
    error?: string;
  };
  if (!body.success) throw new Error(body.error || "Generation failed");
  return { questions: body.questions, model: body.model };
}

export async function importQuestionsFromPaper(input: {
  fileName: string;
  paperText: string;
  images?: string[];
  maxQuestions?: number;
}): Promise<{ questions: AiGeneratedQuestion[]; model: string; scanned: boolean }> {
  const res = await fetch("/api/ai/import-paper", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as {
    success: boolean;
    questions: AiGeneratedQuestion[];
    model: string;
    scanned?: boolean;
    error?: string;
  };
  if (!body.success) throw new Error(body.error || "Could not read questions from the paper");
  return {
    questions: body.questions,
    model: body.model,
    scanned: Boolean(body.scanned),
  };
}

export async function explainWithAi(
  input: ExplainInput
): Promise<{ explanation: string; model: string }> {
  const res = await fetch("/api/ai/explain", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ kind: "sop", ...input }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as {
    success: boolean;
    explanation: string;
    model: string;
    error?: string;
  };
  if (!body.success) throw new Error(body.error || "Explain failed");
  return { explanation: body.explanation, model: body.model };
}

export async function explainSopWithAi(
  input: ExplainSopInput
): Promise<{ explanation: string; model: string }> {
  return explainWithAi({ ...input, kind: input.kind || "sop" });
}

export async function draftJdWithAi(input: {
  jobTitle: string;
  department?: string;
  notes?: string;
}): Promise<{ draft: JdDraft; model: string }> {
  const res = await fetch("/api/ai/draft", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ kind: "jd", ...input }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as {
    success: boolean;
    draft: JdDraft;
    model: string;
    error?: string;
  };
  if (!body.success) throw new Error(body.error || "JD draft failed");
  return { draft: body.draft, model: body.model };
}

export async function draftTniWithAi(input: {
  jobTitle: string;
  responsibilities: string;
  notes?: string;
}): Promise<{ needs: TniNeedDraft[]; model: string }> {
  const res = await fetch("/api/ai/draft", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ kind: "tni", ...input }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as {
    success: boolean;
    needs: TniNeedDraft[];
    model: string;
    error?: string;
  };
  if (!body.success) throw new Error(body.error || "TNI draft failed");
  return { needs: body.needs, model: body.model };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chatWithTrainingAi(input: {
  message: string;
  history?: ChatMessage[];
  contextNote?: string;
}): Promise<{ reply: string; model: string }> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as {
    success: boolean;
    reply: string;
    model: string;
    error?: string;
  };
  if (!body.success) throw new Error(body.error || "Chat failed");
  return { reply: body.reply, model: body.model };
}

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

export async function generateExamBlueprintWithAi(input: {
  topic: string;
  context?: string;
  audience?: "induction" | "sop_retrain" | "general";
}): Promise<{ blueprint: ExamBlueprint; model: string }> {
  const res = await fetch("/api/ai/exam-blueprint", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as {
    success: boolean;
    blueprint: ExamBlueprint;
    model: string;
    error?: string;
  };
  if (!body.success) throw new Error(body.error || "Blueprint failed");
  return { blueprint: body.blueprint, model: body.model };
}
