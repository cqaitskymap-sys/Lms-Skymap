import assert from "node:assert/strict";
import test from "node:test";
import { attemptsRemaining, hasOutstandingTraining } from "./training-cycle";

test("retries stay open until maxAttempts is used up", () => {
  assert.equal(attemptsRemaining(1, 3), true);
  assert.equal(attemptsRemaining(3, 3), false);
  assert.equal(attemptsRemaining(0, 0), true);
  assert.equal(attemptsRemaining(1, 0), false);
});

test("a failed sibling SOP blocks lifecycle pass until it is covered", () => {
  const rows = [
    { id: "a", sopId: "sop-1", status: "passed" },
    { id: "b", sopId: "sop-2", status: "failed" },
  ];
  assert.equal(hasOutstandingTraining(rows, "a"), true);
  assert.equal(
    hasOutstandingTraining(
      [...rows, { id: "c", sopId: "sop-2", status: "retraining" }],
      "a"
    ),
    true
  );
  assert.equal(
    hasOutstandingTraining(
      [
        { id: "a", sopId: "sop-1", status: "passed" },
        { id: "b", sopId: "sop-1", status: "failed" },
      ],
      "a"
    ),
    false
  );
});
