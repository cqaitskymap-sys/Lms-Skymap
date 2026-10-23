import assert from "node:assert/strict";
import test from "node:test";
import { isDashboardHomePath, moduleIdForPath } from "./modules";

test("department, employee, and trainer homes do not swallow the list pages", () => {
  assert.equal(moduleIdForPath("/dashboard/department"), "dashboard");
  assert.equal(moduleIdForPath("/dashboard/departments"), "departments");
  assert.equal(moduleIdForPath("/dashboard/employee"), "dashboard");
  assert.equal(moduleIdForPath("/dashboard/employees"), "employees");
  assert.equal(moduleIdForPath("/dashboard/employees/new"), "employees_new");
  assert.equal(moduleIdForPath("/dashboard/trainer"), "dashboard");
  assert.equal(moduleIdForPath("/dashboard/trainers"), "trainers");
  assert.equal(isDashboardHomePath("/dashboard/departments"), false);
  assert.equal(isDashboardHomePath("/dashboard/employees"), false);
  assert.equal(isDashboardHomePath("/dashboard/trainers"), false);
  assert.equal(isDashboardHomePath("/dashboard/qa"), true);
});
