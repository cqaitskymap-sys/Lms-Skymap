import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  classifyLegacyFile,
  formatLegacyDate,
  parseLegacyWorkbook,
  parseSheetDate,
} from "./legacy-sheet";

test("excel serials use the 1900 date system", () => {
  assert.equal(formatLegacyDate(44927), "2023-01-01");
  assert.equal(formatLegacyDate(46294), "2026-09-29");
  assert.equal(formatLegacyDate(46294.00011574074), "2026-09-29");
});

test("text dates keep the calendar day", () => {
  assert.equal(formatLegacyDate("29/09/2026"), "2026-09-29");
  assert.equal(formatLegacyDate("29-Sep-2026"), "2026-09-29");
  assert.equal(formatLegacyDate("Sep 29, 2026"), "2026-09-29");
  assert.equal(formatLegacyDate("2026-09-29"), "2026-09-29");
  assert.equal(formatLegacyDate("31/02/2026"), "");
  assert.equal(formatLegacyDate(20260929), "2026-09-29");
});

test("a timestamp 1ms before local midnight belongs to the next calendar day", () => {
  const midnight = new Date(2026, 8, 29, 0, 0, 0, 0);
  const almost = new Date(midnight.getTime() - 1);
  assert.equal(formatLegacyDate(almost), "2026-09-29");
});

test("unreadable date cells are reported instead of dropped", () => {
  assert.deepEqual(parseSheetDate(""), { iso: "" });
  assert.equal(parseSheetDate("not-a-date").iso, "");
  assert.match(parseSheetDate("not-a-date").issue || "", /not-a-date/);
});

test("workbook dates round-trip to the same calendar day", () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Employee code", "Employee name", "Date of joining"],
    ["EMP1001", "Ada Lovelace", new Date(2026, 8, 29)],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employees");
  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const rows = parseLegacyWorkbook(Uint8Array.from(bytes).buffer as ArrayBuffer, []);
  assert.equal(rows[0]?.employeeCode, "EMP1001");
  assert.equal(rows[0]?.dateOfJoining, "2026-09-29");
  assert.equal(rows[0]?.dateIssue, undefined);
});

test("JD and TNI files match the employee code with extra words", () => {
  assert.deepEqual(classifyLegacyFile("EMP1001_JD.pdf"), { code: "EMP1001", kind: "jd" });
  assert.deepEqual(classifyLegacyFile("EMP1001_JD_signed.pdf"), { code: "EMP1001", kind: "jd" });
  assert.deepEqual(classifyLegacyFile("TNI-EMP1001-final.pdf", ["EMP1001"]), {
    code: "EMP1001",
    kind: "tni",
  });
  assert.equal(classifyLegacyFile("notes.pdf", ["EMP1001"]), null);
  assert.deepEqual(classifyLegacyFile("EMP10_JD.pdf", ["EMP1", "EMP10"]), {
    code: "EMP10",
    kind: "jd",
  });
});
