import assert from "node:assert/strict";
import test from "node:test";
import { calendarDateToIso, calendarDayKey, formatDate, formatDateTime, localDayBound } from "./utils";

test("date-only values are stored at noon UTC", () => {
  assert.equal(calendarDateToIso("2026-10-17"), "2026-10-17T12:00:00.000Z");
  assert.equal(calendarDateToIso(" 2026-10-17T00:00:00.000Z "), "2026-10-17T12:00:00.000Z");
});

test("a full timestamp keeps its instant", () => {
  assert.equal(calendarDateToIso("2026-10-17T19:30:00.000Z"), "2026-10-17T19:30:00.000Z");
});

test("unreadable dates are rejected", () => {
  assert.throws(() => calendarDateToIso("not-a-date"), /Invalid date/);
  assert.throws(() => calendarDateToIso("2026-02-31"), /Invalid date/);
});

test("calendar dates format as the stored day", () => {
  const label = formatDate("2026-10-17T12:00:00.000Z");
  assert.match(label, /17/);
  assert.match(label, /2026/);
  assert.doesNotMatch(label, /18/);
});

test("invalid timestamps render as a dash", () => {
  assert.equal(formatDateTime("not-a-date"), "—");
});

test("a real timestamp is not forced onto its UTC date", () => {
  const iso = "2026-10-17T19:30:00.000Z";
  const parsed = new Date(iso);
  parsed.setHours(23, 59, 59, 999);
  assert.equal(localDayBound(iso, true), parsed.getTime());
});

test("stored calendar days keep their written day", () => {
  assert.equal(calendarDayKey("2026-10-17"), "2026-10-17");
  assert.equal(calendarDayKey("2026-10-17T12:00:00.000Z"), "2026-10-17");
  assert.equal(calendarDayKey("not-a-date"), null);
});

test("a real timestamp uses the viewer's local day", () => {
  const iso = "2026-10-17T19:30:00.000Z";
  const local = new Date(iso);
  const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  assert.equal(calendarDayKey(iso), expected);
});

test("a date-only bound is the end of that calendar day", () => {
  assert.equal(
    localDayBound("2026-10-17", true),
    new Date(2026, 9, 17, 23, 59, 59, 999).getTime()
  );
});
