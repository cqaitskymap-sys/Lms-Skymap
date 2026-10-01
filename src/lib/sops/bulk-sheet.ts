import * as XLSX from "xlsx";
import type { Department } from "@/types";
import { matchDepartment, parseSheetDate } from "@/lib/onboarding/legacy-sheet";
import { reviewDateFromEffective } from "@/lib/utils";

export interface SopBulkDraft {
  key: string;
  sopNumber: string;
  title: string;
  versionNumber: string;
  departmentIds: string[];
  departmentText: string;
  unmatchedDepartments: string[];
  effectiveDate: string;
  reviewDate: string;
  effectiveDateIssue?: string;
  reviewDateIssue?: string;
  files: File[];
}

const HEADER_FIELDS: Record<string, keyof SopBulkDraft | "departments"> = {
  sopnumber: "sopNumber",
  sopno: "sopNumber",
  sop: "sopNumber",
  number: "sopNumber",
  title: "title",
  soptitle: "title",
  version: "versionNumber",
  versionnumber: "versionNumber",
  departments: "departments",
  department: "departments",
  dept: "departments",
  effectivedate: "effectiveDate",
  effective: "effectiveDate",
  reviewdate: "reviewDate",
  review: "reviewDate",
};

function headerKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function blankSopBulkDraft(): SopBulkDraft {
  return {
    key: crypto.randomUUID(),
    sopNumber: "",
    title: "",
    versionNumber: "1",
    departmentIds: [],
    departmentText: "",
    unmatchedDepartments: [],
    effectiveDate: "",
    reviewDate: "",
    files: [],
  };
}

function splitDepartmentTokens(value: string): string[] {
  return value
    .split(/[,;|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function resolveDepartments(
  value: string,
  departments: Department[]
): { departmentIds: string[]; unmatchedDepartments: string[] } {
  const ids: string[] = [];
  const unmatched: string[] = [];
  for (const token of splitDepartmentTokens(value)) {
    const dept = matchDepartment(token, departments);
    if (!dept) {
      unmatched.push(token);
      continue;
    }
    if (!ids.includes(dept.id)) ids.push(dept.id);
  }
  return { departmentIds: ids, unmatchedDepartments: unmatched };
}

export function downloadSopBulkTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([
    [
      "SOP number",
      "Title",
      "Version",
      "Departments",
      "Effective date",
      "Review date",
    ],
  ]);
  ws["!cols"] = [
    { wch: 16 },
    { wch: 32 },
    { wch: 10 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SOPs");
  XLSX.writeFile(wb, "sop-bulk-entry.xlsx");
}

export function parseSopBulkWorkbook(data: ArrayBuffer, departments: Department[]): SopBulkDraft[] {
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
  if (!columns.includes("sopNumber") || !columns.includes("title")) {
    throw new Error("Use the template columns: SOP number and Title are required");
  }

  const drafts: SopBulkDraft[] = [];
  for (const row of matrix.slice(headerIndex + 1)) {
    const draft = blankSopBulkDraft();
    let departmentText = "";
    columns.forEach((field, index) => {
      if (!field) return;
      const raw = row[index];
      if (field === "departments") {
        departmentText = String(raw ?? "").trim();
        return;
      }
      if (field === "effectiveDate" || field === "reviewDate") {
        const parsed = parseSheetDate(raw);
        draft[field] = parsed.iso;
        draft[field === "effectiveDate" ? "effectiveDateIssue" : "reviewDateIssue"] = parsed.issue;
        return;
      }
      if (field === "sopNumber") {
        draft.sopNumber = String(raw ?? "").trim().toUpperCase();
        return;
      }
      if (field === "versionNumber") {
        const version = String(raw ?? "").trim().replace(/^v/i, "");
        draft.versionNumber = version || "1";
        return;
      }
      if (
        field === "key" ||
        field === "departmentIds" ||
        field === "departmentText" ||
        field === "unmatchedDepartments" ||
        field === "files"
      ) {
        return;
      }
      draft[field] = String(raw ?? "").trim();
    });
    if (!draft.sopNumber && !draft.title) continue;
    if (!draft.versionNumber) draft.versionNumber = "1";
    draft.departmentText = departmentText;
    const resolved = resolveDepartments(departmentText, departments);
    draft.departmentIds = resolved.departmentIds;
    draft.unmatchedDepartments = resolved.unmatchedDepartments;
    if (draft.effectiveDate && !draft.reviewDate && !draft.reviewDateIssue) {
      draft.reviewDate = reviewDateFromEffective(draft.effectiveDate);
    }
    drafts.push(draft);
  }
  if (!drafts.length) throw new Error("No SOP rows found under the header");
  return drafts;
}

const SOP_BULK_EXTENSIONS = new Set(["pdf", "ppt", "pptx", "mp4", "webm", "mov"]);

export function isSopBulkUploadFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return SOP_BULK_EXTENSIONS.has(ext);
}

function compactCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

/** True when the SOP number appears in the label without gluing onto a longer number. */
function containsSopCode(label: string, code: string): boolean {
  const hay = compactCode(label);
  const needle = compactCode(code);
  if (!needle || !hay) return false;
  let from = 0;
  while (from <= hay.length - needle.length) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return false;
    const next = hay[at + needle.length] ?? "";
    const prev = at > 0 ? hay[at - 1] : "";
    const gluedNumber =
      (/\d$/.test(needle) && /\d/.test(next)) || (/^\d/.test(needle) && /\d/.test(prev));
    if (!gluedNumber) return true;
    from = at + 1;
  }
  return false;
}

export function matchSopLabel(label: string, sopNumbers: string[]): string | null {
  const candidates = sopNumbers
    .map((number) => number.trim().toUpperCase())
    .filter(Boolean)
    .sort((a, b) => compactCode(b).length - compactCode(a).length);
  for (const code of candidates) {
    if (containsSopCode(label, code)) return code;
  }
  return null;
}

/** A file belongs to an SOP when its name contains the SOP number. */
export function matchSopFile(fileName: string, sopNumbers: string[]): string | null {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return matchSopLabel(base, sopNumbers);
}

/** Match the file name first, then the nearest folder name (for a folder upload). */
export function matchSopUploadName(
  fileName: string,
  relativePath: string,
  sopNumbers: string[]
): string | null {
  const fromFile = matchSopFile(fileName, sopNumbers);
  if (fromFile) return fromFile;
  const parts = relativePath.split(/[/\\]/).filter(Boolean);
  for (let i = parts.length - 2; i >= 0; i -= 1) {
    const hit = matchSopLabel(parts[i], sopNumbers);
    if (hit) return hit;
  }
  return null;
}

export function applySopBulkFiles(
  rows: SopBulkDraft[],
  files: File[]
): { rows: SopBulkDraft[]; unmatched: string[] } {
  const next = rows.map((row) => ({ ...row, files: [...row.files] }));
  const unmatched: string[] = [];
  const numbers = next.map((row) => row.sopNumber);
  for (const file of files) {
    const relative = "webkitRelativePath" in file ? file.webkitRelativePath : "";
    const code = matchSopUploadName(file.name, relative, numbers);
    const row = code ? next.find((item) => item.sopNumber.toUpperCase() === code) : undefined;
    if (!row) {
      unmatched.push(file.name);
      continue;
    }
    const already = row.files.some((item) => item.name === file.name && item.size === file.size);
    if (!already) row.files.push(file);
  }
  return { rows: next, unmatched };
}

export function sopBulkRowIssues(row: SopBulkDraft, duplicate = false): string[] {
  const issues: string[] = [];
  if (row.sopNumber.trim().length < 3) issues.push("SOP number");
  if (duplicate) issues.push("Duplicate SOP number");
  if (row.title.trim().length < 3) issues.push("Title");
  if (!/^\d+(\.\d+)?$/.test(row.versionNumber.trim())) issues.push("Version");
  if (!row.departmentIds.length) issues.push("Department");
  if (row.unmatchedDepartments.length) issues.push("Unknown department");
  if (row.effectiveDateIssue) issues.push(`Effective date (${row.effectiveDateIssue})`);
  if (row.reviewDateIssue) issues.push(`Review date (${row.reviewDateIssue})`);
  if (!row.files.length) issues.push("PDF");
  return issues;
}
