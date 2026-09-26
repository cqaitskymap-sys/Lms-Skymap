import assert from "node:assert/strict";
import test from "node:test";
import {
  statusAfterEmployeeAck,
  statusAfterHodDecision,
  statusAfterTrainerCompletion,
} from "./workflow";

const allOn = {
  requireEmployeeAck: true,
  requireTrainerSignoff: true,
  requireHodVerification: true,
  requireQaApproval: true,
};

test("missing OJT approval flags still require HOD after employee acknowledgement", () => {
  const next = statusAfterEmployeeAck({
    requireEmployeeAck: undefined as unknown as boolean,
    requireTrainerSignoff: undefined as unknown as boolean,
    requireHodVerification: undefined as unknown as boolean,
    requireQaApproval: undefined as unknown as boolean,
  });
  assert.equal(next, "verification_pending");
});

test("explicit false skips only that approval gate", () => {
  assert.equal(
    statusAfterEmployeeAck({
      ...allOn,
      requireHodVerification: false,
    }),
    "qa_pending"
  );
  assert.equal(
    statusAfterEmployeeAck({
      ...allOn,
      requireHodVerification: false,
      requireQaApproval: false,
    }),
    "completed"
  );
});

test("trainer completion follows the configured gates", () => {
  assert.equal(statusAfterTrainerCompletion(allOn, false), "failed");
  assert.equal(statusAfterTrainerCompletion(allOn, true), "trainer_completed");
  assert.equal(
    statusAfterTrainerCompletion({ ...allOn, requireEmployeeAck: false }, true),
    "verification_pending"
  );
});

test("HOD rejection returns the record to training", () => {
  assert.equal(statusAfterHodDecision(allOn, "rejected"), "in_progress");
  assert.equal(statusAfterHodDecision(allOn, "approved"), "qa_pending");
  assert.equal(
    statusAfterHodDecision({ ...allOn, requireQaApproval: false }, "approved"),
    "completed"
  );
});
