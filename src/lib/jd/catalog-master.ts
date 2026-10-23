import {
  builtinCatalogSnapshot,
  type JdCatalogSnapshot,
  type JdDesignationResponsibilities,
  type JdResponsibilityGroup,
} from "@/lib/jd/responsibility-catalog";

export interface JdMasterRecord {
  id: string;
  departmentId: string;
  sections: JdCatalogSnapshot["sections"];
  designations: JdCatalogSnapshot["designations"];
  updatedAt: string;
  updatedBy?: string;
}

export function snapshotFromMaster(record: JdMasterRecord | null | undefined): JdCatalogSnapshot | null {
  if (!record) return null;
  return {
    sections: Array.isArray(record.sections) ? record.sections : [],
    designations: Array.isArray(record.designations) ? record.designations : [],
  };
}

/** Saved admin lists replace the built-in lists for that department. */
export function resolveJdCatalog(
  dept: { name: string; code: string },
  saved: JdCatalogSnapshot | null
): JdCatalogSnapshot {
  if (saved) return saved;
  return builtinCatalogSnapshot(dept);
}

function cleanDesignation(row: JdDesignationResponsibilities): JdDesignationResponsibilities | null {
  const designation = row.designation.trim();
  if (!designation) return null;
  const groups: JdResponsibilityGroup[] = [];
  row.groups.forEach((group, groupIndex) => {
    const lines = group.lines
      .map((line, lineIndex) => ({
        id: line.id || `${row.id}-${groupIndex + 1}-${lineIndex + 1}`,
        code: line.code.trim(),
        text: line.text.trim(),
      }))
      .filter((line) => line.text);
    const title = group.title.trim();
    if (!title && lines.length === 0) return;
    groups.push({
      code: group.code.trim() || String(groupIndex + 1),
      title: title || "Responsibilities",
      lines,
    });
  });
  return { id: row.id, designation, groups };
}

function uniqueDesignations(
  rows: JdDesignationResponsibilities[]
): JdDesignationResponsibilities[] {
  const seen = new Set<string>();
  const next: JdDesignationResponsibilities[] = [];
  for (const row of rows) {
    const cleaned = cleanDesignation(row);
    if (!cleaned) continue;
    const key = cleaned.designation.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Designation "${cleaned.designation}" is listed twice`);
    }
    seen.add(key);
    next.push(cleaned);
  }
  return next;
}

/** Trim blank rows and reject duplicate names before saving. */
export function normalizeJdCatalogDraft(draft: JdCatalogSnapshot): JdCatalogSnapshot {
  const seenSections = new Set<string>();
  const sections = draft.sections.map((section) => {
    const name = section.name.trim();
    if (!name) throw new Error("Sub department name is required");
    const key = name.toLowerCase();
    if (seenSections.has(key)) throw new Error(`Sub department "${name}" is listed twice`);
    seenSections.add(key);
    return { name, designations: uniqueDesignations(section.designations) };
  });
  return {
    sections,
    designations: uniqueDesignations(draft.designations),
  };
}
