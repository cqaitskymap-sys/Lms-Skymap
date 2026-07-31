/**
 * Pure assessment scoring & question selection — no I/O.
 */

import type {
  AttemptQuestion,
  Exam,
  Question,
  QuestionDifficulty,
  QuestionType,
} from "@/types";
import { shuffleArray, calculatePercentage } from "@/lib/utils";

export function optionsMatch(selected: string[], correct: string[]): boolean {
  const a = new Set(selected);
  const b = new Set(correct);
  return a.size === b.size && [...b].every((id) => a.has(id));
}

export function scoreQuestion(
  q: Pick<AttemptQuestion, "selectedOptionIds" | "correctOptionIds" | "marks" | "negativeMarks">,
  negativeMarkingEnabled: boolean
): { earnedMarks: number; isCorrect: boolean; negativeApplied: number } {
  const answered = (q.selectedOptionIds?.length || 0) > 0;
  if (!answered) {
    return { earnedMarks: 0, isCorrect: false, negativeApplied: 0 };
  }
  const isCorrect = optionsMatch(q.selectedOptionIds, q.correctOptionIds);
  if (isCorrect) {
    return { earnedMarks: q.marks, isCorrect: true, negativeApplied: 0 };
  }
  if (!negativeMarkingEnabled) {
    return { earnedMarks: 0, isCorrect: false, negativeApplied: 0 };
  }
  const penalty = q.negativeMarks || 0;
  return { earnedMarks: -penalty, isCorrect: false, negativeApplied: penalty };
}

export function selectQuestionsForExam(
  pool: Question[],
  exam: Exam
): Question[] {
  let active = pool.filter((q) => q.isActive);
  const bankIds = new Set([exam.bankId, ...(exam.bankIds || [])]);
  active = active.filter((q) => bankIds.has(q.bankId));

  if (exam.randomizeFromBank && exam.difficultyMix) {
    const picked: Question[] = [];
    const used = new Set<string>();
    for (const diff of ["easy", "medium", "hard"] as QuestionDifficulty[]) {
      const need = exam.difficultyMix[diff] || 0;
      if (!need) continue;
      let candidates = active.filter((q) => q.difficulty === diff && !used.has(q.id));
      if (exam.shuffleQuestions) candidates = shuffleArray(candidates);
      for (const q of candidates.slice(0, need)) {
        picked.push(q);
        used.add(q.id);
      }
    }
    // Fill remaining slots randomly
    const remaining = exam.questionCount - picked.length;
    if (remaining > 0) {
      let rest = active.filter((q) => !used.has(q.id));
      if (exam.shuffleQuestions) rest = shuffleArray(rest);
      picked.push(...rest.slice(0, remaining));
    }
    return exam.shuffleQuestions ? shuffleArray(picked) : picked;
  }

  if (exam.shuffleQuestions) active = shuffleArray(active);
  return active.slice(0, exam.questionCount);
}

export function toAttemptQuestions(
  questions: Question[],
  exam: Exam
): AttemptQuestion[] {
  return questions.map((q) => {
    let options = q.options.map((o) => ({ id: o.id, text: o.text }));
    if (exam.shuffleOptions) options = shuffleArray(options);
    const negative =
      q.negativeMarks ??
      (exam.negativeMarkingEnabled ? exam.defaultNegativeMarks || 0 : 0);
    return {
      questionId: q.id,
      text: q.text,
      type: q.type,
      options,
      selectedOptionIds: [],
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      marks: q.marks,
      negativeMarks: negative,
      earnedMarks: 0,
      isCorrect: false,
      isAnswered: false,
      explanation: q.explanation,
      scenario: q.scenario,
      media: q.media,
      difficulty: q.difficulty,
    };
  });
}

/** Strip answer keys for in-progress client payloads when needed. */
export function sanitizeAttemptForClient(
  questions: AttemptQuestion[],
  revealAnswers: boolean
): AttemptQuestion[] {
  if (revealAnswers) return questions;
  return questions.map((q) => ({
    ...q,
    correctOptionIds: [],
    explanation: undefined,
  }));
}

export function evaluateAttempt(
  questions: AttemptQuestion[],
  answers: Record<string, string[]>,
  exam: Exam
): {
  questions: AttemptQuestion[];
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  certificateEligible: boolean;
  negativeMarksApplied: number;
  difficultyBreakdown: Record<QuestionDifficulty, { correct: number; total: number }>;
  typeBreakdown: Partial<Record<QuestionType, { correct: number; total: number }>>;
} {
  let score = 0;
  let maxScore = 0;
  let negativeMarksApplied = 0;
  const difficultyBreakdown: Record<QuestionDifficulty, { correct: number; total: number }> = {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  };
  const typeBreakdown: Partial<Record<QuestionType, { correct: number; total: number }>> = {};

  const evaluated = questions.map((q) => {
    const selected = answers[q.questionId] ?? q.selectedOptionIds ?? [];
    const { earnedMarks, isCorrect, negativeApplied } = scoreQuestion(
      {
        selectedOptionIds: selected,
        correctOptionIds: q.correctOptionIds,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
      },
      exam.negativeMarkingEnabled
    );
    score += earnedMarks;
    maxScore += q.marks;
    negativeMarksApplied += negativeApplied;

    difficultyBreakdown[q.difficulty].total += 1;
    if (isCorrect) difficultyBreakdown[q.difficulty].correct += 1;

    const tb = typeBreakdown[q.type] || { correct: 0, total: 0 };
    tb.total += 1;
    if (isCorrect) tb.correct += 1;
    typeBreakdown[q.type] = tb;

    return {
      ...q,
      selectedOptionIds: selected,
      earnedMarks,
      isCorrect,
      isAnswered: selected.length > 0,
    };
  });

  // Floor score at 0 for percentage display (negative marking can go below)
  const percentage = calculatePercentage(Math.max(0, score), maxScore || 1);
  const passed = percentage >= exam.passPercentage;
  const certThreshold = exam.certificatePassPercentage ?? exam.passPercentage;
  const certificateEligible = percentage >= certThreshold && passed;

  return {
    questions: evaluated,
    score,
    maxScore,
    percentage,
    passed,
    certificateEligible,
    negativeMarksApplied,
    difficultyBreakdown,
    typeBreakdown,
  };
}
