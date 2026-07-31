import type { Department } from "@/types";

const ts = "2026-01-01T00:00:00.000Z";

/** Standard pharmaceutical company departments (GMP/GDP org structure). */
export const PHARMA_DEFAULT_DEPARTMENTS: Omit<Department, "id">[] = [
  { code: "QA", name: "Quality Assurance", description: "QA systems, batch release, GMP compliance", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "QC", name: "Quality Control", description: "Testing, sampling, analytical release", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "IPQA", name: "In-Process QA", description: "Line clearance, in-process checks, shop-floor QA", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "PRD", name: "Production", description: "Manufacturing & batch manufacturing records", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "FRM", name: "Formulation", description: "Formulation development & scale-up support", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "PKG", name: "Packaging", description: "Primary & secondary packaging operations", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "WH", name: "Warehouse", description: "Raw material, finished goods & cold chain storage", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "MICRO", name: "Microbiology", description: "Sterility, bioburden & environmental monitoring", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "RND", name: "Research & Development", description: "Product development & technology transfer", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "ARD", name: "Analytical R&D", description: "Method development & validation support", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "VAL", name: "Validation", description: "Process, cleaning & computer system validation", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "RA", name: "Regulatory Affairs", description: "DMF, submissions & regulatory compliance", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "DOC", name: "Documentation", description: "Document control, DMS & batch record review", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "ENG", name: "Engineering", description: "Utilities, maintenance & calibration", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "EHS", name: "EHS", description: "Environment, health, safety & hygiene", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "PUR", name: "Purchase", description: "Vendor qualification & material procurement", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "SC", name: "Supply Chain", description: "Planning, logistics & dispatch", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "IT", name: "IT", description: "Computer systems, CSV & infrastructure", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "HRD", name: "Human Resources", description: "Recruitment, training records & personnel", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
  { code: "ADM", name: "Administration", description: "General administration & facilities", isActive: true, createdAt: ts, updatedAt: ts, createdBy: "system" },
];

export function departmentIdFromCode(code: string): string {
  return `dept_${code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

export function toDefaultDepartments(): Department[] {
  return PHARMA_DEFAULT_DEPARTMENTS.map((d) => ({
    ...d,
    id: departmentIdFromCode(d.code),
  }));
}
