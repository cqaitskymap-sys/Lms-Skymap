import assert from "node:assert/strict";
import test from "node:test";
import {
  departmentHasResponsibilityCatalog,
  designationsForDepartment,
  sectionsForDepartment,
} from "./responsibility-catalog";

test("in-process QA has its own catalog and does not receive QA duties", () => {
  const dept = { name: "In-Process QA", code: "IPQA" };
  assert.equal(departmentHasResponsibilityCatalog(dept), true);
  const sections = sectionsForDepartment(dept);
  assert.deepEqual(sections, ["IPQA (Incharge)", "IPQA"]);
  assert.equal(sections.includes("Stability"), false);
  assert.deepEqual(
    designationsForDepartment(dept, "IPQA (Incharge)").map((row) => row.designation),
    ["Executive/Sr. Executive"]
  );
  assert.deepEqual(
    designationsForDepartment(dept, "IPQA").map((row) => row.designation),
    ["Executive/Sr. Executive", "Officer/Sr. Officer", "Trainee/Officer"]
  );
  assert.equal(designationsForDepartment(dept).length, 0);
  assert.equal(
    sectionsForDepartment({ name: "Quality Assurance", code: "QA" }).includes("IPQA (Incharge)"),
    false
  );
});

test("QA, Production, and HR catalogs stay on their own departments", () => {
  assert.ok(sectionsForDepartment({ name: "Quality Assurance", code: "QA" }).includes("Stability"));
  assert.deepEqual(
    designationsForDepartment({ name: "Quality Assurance", code: "QA" }, "Validation").map(
      (row) => row.designation
    ),
    ["Officer/Sr. Officer", "Executive/Sr. Executive", "Manager"]
  );
  const production = sectionsForDepartment({ name: "Production", code: "PRD" });
  assert.ok(production.includes("Manufacturing process"));
  assert.ok(production.includes("Packing Operator"));
  assert.equal(sectionsForDepartment({ name: "Human Resources", code: "HRD" }).length, 0);
  assert.ok(
    designationsForDepartment({ name: "Human Resources", code: "HRD" }).some(
      (row) => row.designation === "Officer HR"
    )
  );
  assert.equal(departmentHasResponsibilityCatalog({ name: "Quality Control", code: "QC" }), true);
  assert.ok(sectionsForDepartment({ name: "Quality Control", code: "QC" }).includes("RM / PM"));
  assert.equal(
    sectionsForDepartment({ name: "Quality Assurance", code: "QA" }).includes("RM / PM"),
    false
  );
  assert.equal(departmentHasResponsibilityCatalog({ name: "Packaging", code: "PKG" }), false);
  assert.equal(departmentHasResponsibilityCatalog({ name: "QA Microbiology", code: "QAM" }), false);
  assert.equal(departmentHasResponsibilityCatalog({ name: "Microbiology", code: "MICRO" }), false);
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
