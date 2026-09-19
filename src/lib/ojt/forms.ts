import type {
  OjtFormApprovalConfig,
  OjtFormDocument,
  OjtFormKind,
  OjtFormSignoff,
  OjtFormSignoffRole,
  OjtFormStatus,
  OjtSettings,
} from "@/types/ojt";
import {
  DEFAULT_MATRIX_FORM_NUMBER,
  DEFAULT_OJT_COMPANY_NAME,
  DEFAULT_OJT_DIVISION,
  DEFAULT_OJT_FORM_APPROVALS,
  DEFAULT_OJT_SETTINGS,
  DEFAULT_PLANNER_FORM_NUMBER,
  formatRevisionNumber,
} from "@/lib/ojt/constants";

export function mergeOjtSettings(raw?: Partial<OjtSettings> | null): OjtSettings {
  const now = new Date().toISOString();
  return {
    ...DEFAULT_OJT_SETTINGS,
    createdAt: raw?.createdAt || now,
    updatedAt: raw?.updatedAt || now,
    createdBy: raw?.createdBy || "system",
    ...raw,
    id: "global",
    plannerApprovals: {
      ...DEFAULT_OJT_FORM_APPROVALS,
      ...raw?.plannerApprovals,
      requireCheckedByCoordinator: false,
      requireVerifiedByHod: false,
    },
    matrixApprovals: {
      ...DEFAULT_OJT_FORM_APPROVALS,
      ...raw?.matrixApprovals,
      requireCheckedByCoordinator: false,
      requireVerifiedByHod: false,
    },
    plannerFormNumber: raw?.plannerFormNumber || DEFAULT_PLANNER_FORM_NUMBER,
    matrixFormNumber: raw?.matrixFormNumber || DEFAULT_MATRIX_FORM_NUMBER,
    companyName: raw?.companyName || DEFAULT_OJT_COMPANY_NAME,
    companyDivision: raw?.companyDivision || DEFAULT_OJT_DIVISION,
    allowExecutionBeforeSelection: raw?.allowExecutionBeforeSelection ?? false,
    requireExecutionDeviationApproval: raw?.requireExecutionDeviationApproval ?? true,
    competencyScoringModel: raw?.competencyScoringModel || "both",
  };
}

export function formDocumentId(kind: OjtFormKind, year: number, departmentId: string): string {
  return `ojt_${kind}_${departmentId}_${year}`;
}

export function formApprovalsFor(kind: OjtFormKind, settings: OjtSettings): OjtFormApprovalConfig {
  return kind === "planner" ? settings.plannerApprovals : settings.matrixApprovals;
}

export function formNumberFor(kind: OjtFormKind, settings: OjtSettings): string {
  return kind === "planner" ? settings.plannerFormNumber : settings.matrixFormNumber;
}

export function latestSignoff(
  doc: OjtFormDocument,
  role: OjtFormSignoffRole
): OjtFormSignoff | undefined {
  return [...doc.signoffs].reverse().find((s) => s.role === role && s.action !== "rejected");
}

export function hasAcceptedSignoff(doc: OjtFormDocument, role: OjtFormSignoffRole): boolean {
  const row = latestSignoff(doc, role);
  return Boolean(row && row.action !== "rejected");
}

const ROLE_TO_STATUS: Partial<Record<OjtFormSignoffRole, OjtFormStatus>> = {
  prepared_by: "prepared",
  checked_by_coordinator: "checked",
  verified_by_hod: "checked",
  checked_by_head: "checked",
  approved_by_qa: "approved",
};

export function statusAfterFormSignoff(
  current: OjtFormStatus,
  role: OjtFormSignoffRole,
  rejected: boolean
): OjtFormStatus {
  if (rejected) {
    if (role === "approved_by_qa") return "checked";
    if (role === "checked_by_head" || role === "checked_by_coordinator" || role === "verified_by_hod") {
      return "prepared";
    }
    return "draft";
  }
  const next = ROLE_TO_STATUS[role] || current;
  const rank: Record<OjtFormStatus, number> = { draft: 0, prepared: 1, checked: 2, approved: 3 };
  return rank[next] >= rank[current] ? next : current;
}

export function requiredRolesForApproval(config: OjtFormApprovalConfig): OjtFormSignoffRole[] {
  const roles: OjtFormSignoffRole[] = [];
  if (config.requirePreparedBy) roles.push("prepared_by");
  if (config.requireCheckedByHead) roles.push("checked_by_head");
  if (config.requireApprovedByQa) roles.push("approved_by_qa");
  return roles;
}

export function missingRequiredSignoffs(
  doc: OjtFormDocument,
  config: OjtFormApprovalConfig
): OjtFormSignoffRole[] {
  return requiredRolesForApproval(config).filter((role) => !hasAcceptedSignoff(doc, role));
}

export function canApproveForm(doc: OjtFormDocument, config: OjtFormApprovalConfig): boolean {
  return missingRequiredSignoffs(doc, { ...config, requireApprovedByQa: false }).length === 0;
}

export function assertFormUnlocked(doc: OjtFormDocument | null, action: string): void {
  if (doc?.locked) {
    throw new Error(
      `This ${doc.kind === "planner" ? "yearly planner" : "employee training matrix"} is approved (Rev. ${formatRevisionNumber(doc.revisionNumber)}). Create a revision before ${action}.`
    );
  }
}

export function emptyFormDocument(params: {
  kind: OjtFormKind;
  year: number;
  departmentId: string;
  departmentName?: string;
  settings: OjtSettings;
  actorId: string;
}): OjtFormDocument {
  const now = new Date().toISOString();
  return {
    id: formDocumentId(params.kind, params.year, params.departmentId),
    kind: params.kind,
    year: params.year,
    departmentId: params.departmentId,
    departmentName: params.departmentName,
    effectiveDate: now.slice(0, 10),
    revisionNumber: "00",
    formNumber: formNumberFor(params.kind, params.settings),
    status: "draft",
    companyName: params.settings.companyName,
    signoffs: [],
    revisions: [],
    locked: false,
    createdAt: now,
    updatedAt: now,
    createdBy: params.actorId,
  };
}
