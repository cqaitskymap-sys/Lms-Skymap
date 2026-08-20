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
    const hasTrue = options.some((o) => /^true$/i.test(o.text));
    const hasFalse = options.some((o) => /^false$/i.test(o.text));
    if (!hasTrue || !hasFalse || options.length !== 2) {
      const correctIsTrue = options.some((o) => o.isCorrect && /^true$/i.test(o.text));
      options = [
        {
          id: generateId("opt"),
          text: "True",
          isCorrect: correctIsTrue || !options.some((o) => o.isCorrect),
        },
        {
          id: generateId("opt"),
          text: "False",
          isCorrect: !correctIsTrue && options.some((o) => o.isCorrect),
        },
      ];
      if (!options.some((o) => o.isCorrect)) options[0].isCorrect = true;
    }
  }

  if (!options.some((o) => o.isCorrect) && options.length > 0) {
    options[0].isCorrect = true;
  }

  if (options.length < 2) return null;

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
