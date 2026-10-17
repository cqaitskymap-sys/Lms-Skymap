import assert from "node:assert/strict";
import test from "node:test";
import {
  departmentHasResponsibilityCatalog,
  designationsForDepartment,
  sectionsForDepartment,
} from "./responsibility-catalog";

test("in-process QA does not receive the QA responsibility catalog", () => {
  const dept = { name: "In-Process QA", code: "IPQA" };
  assert.equal(departmentHasResponsibilityCatalog(dept), false);
  assert.deepEqual(sectionsForDepartment(dept), []);
  assert.deepEqual(designationsForDepartment(dept), []);
});

test("QA, Production, and HR catalogs stay on their own departments", () => {
  assert.ok(sectionsForDepartment({ name: "Quality Assurance", code: "QA" }).includes("Stability"));
  const production = sectionsForDepartment({ name: "Production", code: "PRD" });
  assert.ok(production.includes("Manufacturing process"));
  assert.ok(production.includes("Packing Operator"));
  assert.equal(sectionsForDepartment({ name: "Human Resources", code: "HRD" }).length, 0);
  assert.ok(
    designationsForDepartment({ name: "Human Resources", code: "HRD" }).some(
      (row) => row.designation === "Officer HR"
    )
  );
  assert.equal(departmentHasResponsibilityCatalog({ name: "Quality Control", code: "QC" }), false);
  assert.equal(departmentHasResponsibilityCatalog({ name: "Packaging", code: "PKG" }), false);
});

test("a production section shows only that section's designations", () => {
  const filling = designationsForDepartment(
    { name: "Production", code: "PRD" },
    "Filling Operation"
  );
  assert.deepEqual(
    filling.map((row) => row.designation),
    ["Trainee/Officer"]
  );
  assert.equal(
    designationsForDepartment({ name: "Production", code: "PRD" }).length,
    0
  );
});
