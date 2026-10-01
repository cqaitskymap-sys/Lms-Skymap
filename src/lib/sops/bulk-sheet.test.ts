import assert from "node:assert/strict";
import test from "node:test";
import { matchSopFile, matchSopUploadName } from "./bulk-sheet";

const numbers = ["SOP-QA-004", "SOP-QA-0041", "SOP-QA-10"];

test("a PDF named with the SOP number matches that row", () => {
  assert.equal(matchSopFile("SOP-QA-004.pdf", numbers), "SOP-QA-004");
  assert.equal(matchSopFile("sop qa 004 training.pdf", numbers), "SOP-QA-004");
  assert.equal(matchSopFile("Procedure SOP-QA-004 Rev 2.pdf", numbers), "SOP-QA-004");
});

test("a longer SOP number is not attached to the shorter one", () => {
  assert.equal(matchSopFile("SOP-QA-0041.pdf", numbers), "SOP-QA-0041");
  assert.equal(matchSopFile("SOP-QA-10.pdf", numbers), "SOP-QA-10");
  assert.equal(matchSopFile("notes.pdf", numbers), null);
});

test("a folder named with the SOP number matches the PDF inside it", () => {
  assert.equal(
    matchSopUploadName("procedure.pdf", "Batch/SOP-QA-004/procedure.pdf", numbers),
    "SOP-QA-004"
  );
  assert.equal(
    matchSopUploadName("SOP-QA-10.pdf", "SOP-QA-004/SOP-QA-10.pdf", numbers),
    "SOP-QA-10"
  );
});
