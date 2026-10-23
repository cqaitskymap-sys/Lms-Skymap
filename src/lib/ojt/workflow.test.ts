import assert from "node:assert/strict";
import test from "node:test";
import {
  criterionIsFail,
  evaluationDidFail,
  executionDateInPlan,
  statusAfterEmployeeAck,
  statusAfterHodDecision,
  statusAfterQaDecision,
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

test("required NA is not a competent result", () => {
  assert.equal(criterionIsFail({ result: "na", isRequired: true }), true);
  assert.equal(criterionIsFail({ result: "na" }), true);
  assert.equal(criterionIsFail({ result: "na", isRequired: false }), false);
  assert.equal(criterionIsFail({ result: "pass" }), false);
  assert.equal(
    evaluationDidFail([
      { criterionId: "gmp", label: "GMP", result: "pass", isRequired: true },
      { criterionId: "sop", label: "SOP", result: "na", isRequired: true },
    ]),
    true
  );
});

test("QA rejection returns to the previous enabled step", () => {
  assert.equal(statusAfterQaDecision(allOn, "approved"), "completed");
  assert.equal(statusAfterQaDecision(allOn, "rejected"), "verification_pending");
  assert.equal(
    statusAfterQaDecision({ ...allOn, requireHodVerification: false }, "rejected"),
    "trainer_completed"
  );
  assert.equal(
    statusAfterQaDecision(
      { ...allOn, requireHodVerification: false, requireEmployeeAck: false },
      "rejected"
    ),
    "in_progress"
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

test("an execution date is in plan when it falls in any planned month", () => {
  const assignment = {
    year: 2026,
    plannedExecutionMonth: 10,
    plannedExecutionMonths: [10, 11],
  };
  assert.equal(executionDateInPlan("2026-11-15", assignment), true);
  assert.equal(executionDateInPlan("2026-10-01", assignment), true);
  assert.equal(executionDateInPlan("2026-12-01", assignment), false);
});
