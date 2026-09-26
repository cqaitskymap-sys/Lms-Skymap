import assert from "node:assert/strict";
import test from "node:test";
import { optionsMatch, scoreQuestion } from "./engine";

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
