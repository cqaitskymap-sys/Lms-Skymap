import assert from "node:assert/strict";
import test from "node:test";
import { optionsMatch, scoreQuestion, selectQuestionsForExam } from "./engine";

test("options match ignores order and rejects partial answers", () => {
  assert.equal(optionsMatch(["b", "a"], ["a", "b"]), true);
  assert.equal(optionsMatch(["a"], ["a", "b"]), false);
});

test("unanswered questions score zero", () => {
  const scored = scoreQuestion(
    { selectedOptionIds: [], correctOptionIds: ["a"], marks: 2, negativeMarks: 1 },
    true
  );
  assert.deepEqual(scored, { earnedMarks: 0, isCorrect: false, negativeApplied: 0 });
});

test("wrong answers apply negative marks only when enabled", () => {
  const wrong = {
    selectedOptionIds: ["b"],
    correctOptionIds: ["a"],
    marks: 2,
    negativeMarks: 0.5,
  };
  assert.equal(scoreQuestion(wrong, false).earnedMarks, 0);
  assert.equal(scoreQuestion(wrong, true).earnedMarks, -0.5);
  assert.equal(
    scoreQuestion(
      { selectedOptionIds: ["a"], correctOptionIds: ["a"], marks: 2, negativeMarks: 1 },
      true
    ).earnedMarks,
    2
  );
});

test("question selection keeps extra banks and drops duplicate questions", () => {
  const exam = {
    bankId: "",
    bankIds: ["b"],
    questionCount: 5,
    shuffleQuestions: false,
    randomizeFromBank: false,
  } as Parameters<typeof selectQuestionsForExam>[1];
  const question = {
    id: "q1",
    bankId: "b",
    isActive: true,
  } as Parameters<typeof selectQuestionsForExam>[0][number];
  const picked = selectQuestionsForExam(
    [question, question, { ...question, id: "q2" }],
    exam
  );
  assert.deepEqual(
    picked.map((q) => q.id),
    ["q1", "q2"]
  );
});

test("difficulty mix never exceeds the exam question count", () => {
  const exam = {
    bankId: "b",
    questionCount: 2,
    shuffleQuestions: false,
    randomizeFromBank: true,
    difficultyMix: { easy: 5, medium: 5, hard: 5 },
  } as Parameters<typeof selectQuestionsForExam>[1];
  const pool = (["easy", "medium", "hard"] as const).flatMap((difficulty) =>
    [0, 1, 2].map(
      (n) =>
        ({
          id: `${difficulty}-${n}`,
          bankId: "b",
          isActive: true,
          difficulty,
        }) as Parameters<typeof selectQuestionsForExam>[0][number]
    )
  );
  const picked = selectQuestionsForExam(pool, exam);
  assert.equal(picked.length, 2);
  assert.deepEqual(
    picked.map((q) => q.id),
    ["easy-0", "easy-1"]
  );
});
