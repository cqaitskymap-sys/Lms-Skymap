import * as XLSX from "xlsx";
import type { Department } from "@/types";

export interface LegacyDraft {
  key: string;
  employeeCode: string;
  name: string;
  departmentId: string;
  departmentName: string;
  designation: string;
  dateOfJoining: string;
  email: string;
  mobile: string;
  jdNo: string;
  /** Set when a date cell had a value that could not be read. */
  dateIssue?: string;
  jdFile: File | null;
  tniFile: File | null;
}

const HEADER_FIELDS: Record<string, keyof LegacyDraft> = {
  employeecode: "employeeCode",
  employeeid: "employeeCode",
  empcode: "employeeCode",
  code: "employeeCode",
  name: "name",
  employeename: "name",
  fullname: "name",
  department: "departmentName",
  dept: "departmentName",
  designation: "designation",
  dateofjoining: "dateOfJoining",
  doj: "dateOfJoining",
  joiningdate: "dateOfJoining",
  email: "email",
  mobile: "mobile",
  mobilenumber: "mobile",
  phone: "mobile",
  jdno: "jdNo",
  jdnumber: "jdNo",
  jobdescriptionno: "jdNo",
};

function headerKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function blankLegacyDraft(): LegacyDraft {
  return {
    key: crypto.randomUUID(),
    employeeCode: "",
    name: "",
    departmentId: "",
    departmentName: "",
    designation: "",
    dateOfJoining: "",
    email: "",
    mobile: "",
    jdNo: "",
    jdFile: null,
    tniFile: null,
  };
}

export function matchDepartment(value: string, departments: Department[]): Department | undefined {
  const needle = value.trim().toLowerCase();
  if (!needle) return undefined;
  const active = departments.filter((d) => d.isActive);
  return active.find(
    (d) =>
      d.name.trim().toLowerCase() === needle ||
      d.code.trim().toLowerCase() === needle ||
      d.id === value.trim()
  );
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function ymd(year: number, month: number, day: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return "";
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fullYear(year: number): number {
  if (year >= 100) return year;
  return 2000 + year;
}

/** SheetJS date objects can land 1ms before local midnight and show the previous day. */
function calendarDate(value: Date): string {
  if (Number.isNaN(value.getTime())) return "";
  const utcMidnight =
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0;
  if (utcMidnight) {
    return ymd(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  const seconds = value.getHours() * 3600 + value.getMinutes() * 60 + value.getSeconds();
  if (seconds >= 24 * 3600 - 120) {
    const next = new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);
    return ymd(next.getFullYear(), next.getMonth() + 1, next.getDate());
  }
  return ymd(value.getFullYear(), value.getMonth() + 1, value.getDate());
}

/**
 * Excel date cells and common text dates become YYYY-MM-DD.
 * Numeric cells use the Excel 1900 serial (day 44927 = 2023-01-01), not a rounded JS Date.
 */
export function formatLegacyDate(value: unknown): string {
  if (value instanceof Date) return calendarDate(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    const truncated = Math.trunc(Math.abs(value));
    if (String(truncated).length === 8) {
      const year = Math.trunc(truncated / 10000);
      const month = Math.trunc(truncated / 100) % 100;
      const day = truncated % 100;
      const packed = ymd(year, month, day);
      if (packed) return packed;
    }
    const serial = Math.floor(value);
    if (serial < 20000 || serial > 80000) return "";
    const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return ymd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return ymd(year!, month!, day!);
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(text)) {
    return calendarDate(new Date(text));
  }
  const dayMonthName = text.match(/^(\d{1,2})[/. -]([A-Za-z]{3,9})[/. -](\d{2,4})$/);
  if (dayMonthName) {
    const month = MONTHS[dayMonthName[2]!.toLowerCase()];
    if (!month) return "";
    return ymd(fullYear(Number(dayMonthName[3])), month, Number(dayMonthName[1]));
  }
  const monthNameDay = text.match(/^([A-Za-z]{3,9})[/. -](\d{1,2}),?[/. -](\d{2,4})$/);
  if (monthNameDay) {
    const month = MONTHS[monthNameDay[1]!.toLowerCase()];
    if (!month) return "";
    return ymd(fullYear(Number(monthNameDay[3])), month, Number(monthNameDay[2]));
  }
  const slash = text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})$/);
  if (!slash) return "";
  let day = Number(slash[1]);
  let month = Number(slash[2]);
  if (month > 12 && day <= 12) {
    const swap = day;
    day = month;
    month = swap;
  }
  return ymd(fullYear(Number(slash[3])), month, day);
}

export function parseSheetDate(value: unknown): { iso: string; issue?: string } {
  if (value === null || value === undefined) return { iso: "" };
  if (typeof value === "string" && !value.trim()) return { iso: "" };
  const iso = formatLegacyDate(value);
  if (iso) return { iso };
  const label =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).trim().slice(0, 40);
  return { iso: "", issue: label ? `could not read "${label}"` : undefined };
}

export function downloadLegacyTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([
    [
      "Employee code",
      "Employee name",
      "Department",
      "Designation",
      "Date of joining",
      "Email",
      "Mobile",
      "JD number",
    ],
  ]);
  ws["!cols"] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employees");
  XLSX.writeFile(wb, "pre-system-employees.xlsx");
}

export function parseLegacyWorkbook(
  data: ArrayBuffer,
  departments: Department[]
): LegacyDraft[] {
  const wb = XLSX.read(data, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("The spreadsheet has no sheets");
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("The spreadsheet has no sheets");
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const headerRow = matrix.find((row) => row.some((cell) => String(cell ?? "").trim()));
  if (!headerRow) throw new Error("The spreadsheet is empty");
  const headerIndex = matrix.indexOf(headerRow);
  const columns = headerRow.map((cell) => HEADER_FIELDS[headerKey(String(cell ?? ""))]);
  if (!columns.includes("employeeCode") || !columns.includes("name")) {
    throw new Error("Use the template columns: Employee code and Employee name are required");
  }

  const drafts: LegacyDraft[] = [];
  for (const row of matrix.slice(headerIndex + 1)) {
    const draft = blankLegacyDraft();
    columns.forEach((field, index) => {
      if (!field || field === "key" || field === "departmentId" || field === "jdFile" || field === "tniFile") {
        return;
      }
      const raw = row[index];
      if (field === "dateOfJoining") {
        const parsed = parseSheetDate(raw);
        draft.dateOfJoining = parsed.iso;
        draft.dateIssue = parsed.issue;
        return;
      }
      if (field === "employeeCode" || field === "jdNo") {
        draft[field] = String(raw ?? "").trim().toUpperCase();
        return;
      }
      draft[field] = String(raw ?? "").trim();
    });
    if (!draft.employeeCode && !draft.name && !draft.designation) continue;
    const dept = matchDepartment(draft.departmentName, departments);
    if (dept) {
      draft.departmentId = dept.id;
      draft.departmentName = dept.name;
    }
    drafts.push(draft);
  }
  if (!drafts.length) throw new Error("No employee rows found under the header");
  return drafts;
}

function tokenIndex(base: string, code: string): number {
  let from = 0;
  while (from <= base.length - code.length) {
    const idx = base.indexOf(code, from);
    if (idx < 0) return -1;
    const beforeOk = idx === 0 || /[^A-Z0-9]/.test(base.charAt(idx - 1));
    const after = idx + code.length;
    const afterOk = after === base.length || /[^A-Z0-9]/.test(base.charAt(after));
    if (beforeOk && afterOk) return idx;
    from = idx + 1;
  }
  return -1;
}

function kindToken(text: string): "jd" | "tni" | null {
  const hasJd = /(^|[^A-Z0-9])JD([^A-Z0-9]|$)/.test(text);
  const hasTni = /(^|[^A-Z0-9])TNI([^A-Z0-9]|$)/.test(text);
  if (hasJd === hasTni) return null;
  return hasJd ? "jd" : "tni";
}

export function classifyLegacyFile(
  fileName: string,
  employeeCodes: string[] = []
): { code: string; kind: "jd" | "tni" } | null {
  const base = fileName.replace(/\.[^.]+$/, "").trim().toUpperCase();
  if (!base) return null;

  const codes = employeeCodes
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const code of codes) {
    const at = tokenIndex(base, code);
    if (at < 0) continue;
    const rest = `${base.slice(0, at)} ${base.slice(at + code.length)}`;
    const kind = kindToken(rest);
    if (kind) return { code, kind };
  }

  const suffixed = base.match(/^([A-Z0-9][A-Z0-9_-]*?)[_\- .](JD|TNI)(?:[_\- .].*)?$/);
  if (suffixed) {
    return { code: suffixed[1]!, kind: suffixed[2] === "JD" ? "jd" : "tni" };
  }
  const prefixed = base.match(/^(JD|TNI)[_\- .]([A-Z0-9][A-Z0-9_-]*?)(?:[_\- .].*)?$/);
  if (prefixed) {
    return { code: prefixed[2]!, kind: prefixed[1] === "JD" ? "jd" : "tni" };
  }
  return null;
}

export function applyLegacyFiles(rows: LegacyDraft[], files: File[]): {
  rows: LegacyDraft[];
  unmatched: string[];
} {
  const next = rows.map((row) => ({ ...row }));
  const unmatched: string[] = [];
  const codes = next.map((row) => row.employeeCode);
  for (const file of files) {
    const parsed = classifyLegacyFile(file.name, codes);
    if (!parsed) {
      unmatched.push(file.name);
      continue;
    }
    const row = next.find((item) => item.employeeCode.trim().toUpperCase() === parsed.code);
    if (!row) {
      unmatched.push(file.name);
      continue;
    }
    if (parsed.kind === "jd") row.jdFile = file;
    else row.tniFile = file;
  }
  return { rows: next, unmatched };
}

export function legacyDuplicateFields(rows: LegacyDraft[]): {
  codes: Set<string>;
  jdNumbers: Set<string>;
} {
  const codeCounts = new Map<string, number>();
  const jdCounts = new Map<string, number>();
  for (const row of rows) {
    const code = row.employeeCode.trim().toUpperCase();
    if (code) codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    const jdNo = row.jdNo.trim().toUpperCase();
    if (jdNo) jdCounts.set(jdNo, (jdCounts.get(jdNo) || 0) + 1);
  }
  const multiples = (counts: Map<string, number>) =>
    new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key)
    );
  return { codes: multiples(codeCounts), jdNumbers: multiples(jdCounts) };
}

export function legacyRowIssues(
  row: LegacyDraft,
  opts?: { duplicateCode?: boolean; duplicateJd?: boolean }
): string[] {
  const issues: string[] = [];
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(row.employeeCode.trim())) {
    issues.push("Employee code");
  }
  if (opts?.duplicateCode) issues.push("Duplicate employee code");
  if (!row.name.trim()) issues.push("Name");
  if (!row.departmentId) issues.push("Department");
  if (row.designation.trim().length < 2) issues.push("Designation");
  if (row.dateIssue) issues.push(`Date of joining (${row.dateIssue})`);
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dateOfJoining)) issues.push("Date of joining");
  if (opts?.duplicateJd) issues.push("Duplicate JD number");
  if (row.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    issues.push("Email");
  }
  if (!row.jdFile) issues.push("JD file");
  if (!row.tniFile) issues.push("TNI file");
  return issues;
}

export function splitEmployeeName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const [first = "", ...rest] = trimmed ? trimmed.split(" ") : [];
  return { firstName: first, lastName: rest.join(" ") };
}
