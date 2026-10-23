import { generateId } from "@/lib/utils";
import type { QuestionDifficulty, QuestionType } from "@/types";

export interface QuestionDraftInput {
  text: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  options: Array<{ text: string; isCorrect: boolean }>;
  explanation?: string;
  marks: number;
  tags: string[];
  scenario?: { title?: string; narrative: string };
}

export function normalizeQuestion(
  q: QuestionDraftInput,
  allowedTypes: Set<string>,
  difficultyPref: string,
  defaultTags: string[] = ["ai-generated"]
): Record<string, unknown> | null {
  let type = (q.type || "mcq") as QuestionType;
  if (!allowedTypes.has(type) || type === "image") {
    type = (allowedTypes.has("mcq") ? "mcq" : [...allowedTypes][0]) as QuestionType;
  }

  let difficulty = (q.difficulty || "medium") as QuestionDifficulty;
  if (difficultyPref !== "mixed" && ["easy", "medium", "hard"].includes(difficultyPref)) {
    difficulty = difficultyPref as QuestionDifficulty;
  }
  if (!["easy", "medium", "hard"].includes(difficulty)) difficulty = "medium";

  let options = (q.options || [])
    .filter((o) => o && typeof o.text === "string")
    .map((o) => ({
      id: generateId("opt"),
      text: String(o.text).trim(),
      isCorrect: Boolean(o.isCorrect),
    }));

  if (type === "true_false") {
    options = options.map((option) => {
      if (/^(true|yes|t)$/i.test(option.text)) return { ...option, text: "True" };
      if (/^(false|no|f)$/i.test(option.text)) return { ...option, text: "False" };
      return option;
    });
    const hasTrue = options.some((o) => o.text === "True");
    const hasFalse = options.some((o) => o.text === "False");
    const correctCount = options.filter((o) => o.isCorrect).length;
    if (!hasTrue || !hasFalse || options.length !== 2 || correctCount !== 1) return null;
  }

  if (!q.text?.trim() || options.length < 2 || !options.some((o) => o.isCorrect)) return null;

  const marks =
    typeof q.marks === "number" && q.marks > 0
      ? Math.min(10, Math.round(q.marks))
      : difficulty === "easy"
        ? 1
        : difficulty === "hard"
          ? 3
          : 2;

  const tags = Array.isArray(q.tags)
    ? q.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];

  return {
    text: q.text.trim(),
    type,
    difficulty,
    options,
    explanation: q.explanation?.trim() || undefined,
    marks,
    tags: [...new Set([...tags, ...defaultTags])].slice(0, 8),
    scenario:
      type === "scenario" && q.scenario?.narrative
        ? {
            title: q.scenario.title?.trim() || undefined,
            narrative: q.scenario.narrative.trim(),
          }
        : undefined,
  };
}
