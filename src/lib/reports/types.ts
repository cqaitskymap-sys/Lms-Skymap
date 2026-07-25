/**
 * Reports module — types, aggregation, and export helpers.
 */

export type ReportType =
  | "employee_training"
  | "department_compliance"
  | "trainer_performance"
  | "exam_results"
  | "pass_fail"
  | "overdue_training"
  | "upcoming_expiry"
  | "certificate_status"
  | "sop_coverage"
  | "training_matrix"
  | "audit_report";

export interface ReportFilters {
  search: string;
  departmentId: string; // "all" | dept id
  dateFrom: string; // yyyy-mm-dd
  dateTo: string;
}

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ChartPoint {
  name: string;
  value: number;
  secondary?: number;
  fill?: string;
}

export interface ReportDataset {
  type: ReportType;
  title: string;
  description: string;
  generatedAt: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | boolean | null>[];
  kpis: { label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger" }[];
  charts: {
    id: string;
    title: string;
    kind: "bar" | "pie" | "line";
    data: ChartPoint[];
  }[];
}

export const REPORT_CATALOG: {
  type: ReportType;
  title: string;
  description: string;
}[] = [
  {
    type: "employee_training",
    title: "Employee Training",
    description: "Assignments, status, scores per employee",
  },
  {
    type: "department_compliance",
    title: "Department Compliance",
    description: "Completion and compliance rates by department",
  },
  {
    type: "trainer_performance",
    title: "Trainer Performance",
    description: "Sessions delivered, pass rates, retraining load",
  },
  {
    type: "exam_results",
    title: "Exam Results",
    description: "Attempt outcomes with scores and ranks",
  },
  {
    type: "pass_fail",
    title: "Pass % / Fail %",
    description: "Overall and departmental pass/fail distribution",
  },
  {
    type: "overdue_training",
    title: "Overdue Training",
    description: "Assignments past due date still incomplete",
  },
  {
    type: "upcoming_expiry",
    title: "Upcoming Expiry",
    description: "Certificates and SOP reviews nearing expiry",
  },
  {
    type: "certificate_status",
    title: "Certificate Status",
    description: "Issued, active, and revoked certificates",
  },
  {
    type: "sop_coverage",
    title: "SOP Coverage",
    description: "Trained vs required coverage per SOP",
  },
  {
    type: "training_matrix",
    title: "Training Matrix",
    description: "Employee × SOP competency matrix",
  },
  {
    type: "audit_report",
    title: "Audit Report",
    description: "Compliance audit trail of critical actions",
  },
];
