/**
 * On Job Training (OJT) domain types.
 * Practical competency workflow — separate from SOP classroom/exam assignments.
 */

import type { Timestamps, UserRole } from "@/types";

export const CALENDAR_MONTHS = [
  { number: 1, name: "January", short: "Jan" },
  { number: 2, name: "February", short: "Feb" },
  { number: 3, name: "March", short: "Mar" },
  { number: 4, name: "April", short: "Apr" },
  { number: 5, name: "May", short: "May" },
  { number: 6, name: "June", short: "Jun" },
  { number: 7, name: "July", short: "Jul" },
  { number: 8, name: "August", short: "Aug" },
  { number: 9, name: "September", short: "Sep" },
  { number: 10, name: "October", short: "Oct" },
  { number: 11, name: "November", short: "Nov" },
  { number: 12, name: "December", short: "Dec" },
] as const;

export type CalendarMonthNumber = (typeof CALENDAR_MONTHS)[number]["number"];

/**
 * Official planner stores Selection (S) and Execution (E) as separate rows.
 * Combined "S/E" is only a UI convenience when both rows are ticked in the same month.
 */
export type OjtPlannerMark = "S" | "E" | "S/E";

/** Official employee-training-matrix selection cell (PDF: ✓ / NA / blank). */
export type OjtOfficialSelection = "empty" | "selected" | "not_applicable";

export type OjtFormKind = "planner" | "matrix";

export type OjtFormStatus = "draft" | "prepared" | "checked" | "approved";

/** Official form signature slots — not the operational Employee → HOD → QA record flow. */
export type OjtFormSignoffRole =
  | "prepared_by"
  | "checked_by_coordinator"
  | "verified_by_hod"
  | "checked_by_head"
  | "approved_by_qa";

export type OjtCompetencyScoringModel = "pass_fail" | "rating_1_5" | "both";

export type OjtStatus =
  | "draft"
  | "selected"
  | "assigned"
  | "scheduled"
  | "in_progress"
  | "trainer_completed"
  | "employee_acknowledged"
  | "verification_pending"
  | "qa_pending"
  | "completed"
  | "failed"
  | "retraining_required"
  | "rescheduled"
  | "cancelled";

export type OjtMatrixCellValue =
  | "not_set"
  | "not_applicable"
  | "selected"
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "failed"
  | "retraining_required"
  | "overdue"
  | "cancelled";

export type OjtApplicability = "selected" | "not_applicable";

export type OjtTrainingType = "on_job" | "practical" | "demonstration";

export type OjtPlanStatus = "draft" | "planned" | "in_progress" | "completed";

export type OjtOverallCompetency = "competent" | "not_competent" | "pending";

export type OjtCriterionScale = "1-5" | "pass_fail";

export type OjtAttachmentKind =
  | "ojt_record"
  | "observation_sheet"
  | "checklist"
  | "signed_document"
  | "photo"
  | "other";

export interface OjtTopic extends Timestamps {
  id: string;
  trainingTopic: string;
  description?: string;
  departmentId: string;
  departmentName?: string;
  sopId?: string;
  sopNumber?: string;
  sopTitle?: string;
  referenceDocumentNumber?: string;
  sopVersionId?: string;
  sopVersionNumber?: string;
  sopEffectiveDate?: string;
  effectiveDate?: string;
  revisionNumber?: string;
  trainingType: OjtTrainingType;
  isActive: boolean;
  createdByName?: string;
  updatedByName?: string;
}

export interface OjtEmployeeSelection {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  applicability: OjtApplicability;
  /** When ✓ was marked on the official matrix S row. */
  selectionDate?: string;
}

export interface OjtApprovalConfig {
  requireEmployeeAck: boolean;
  requireTrainerSignoff: boolean;
  requireHodVerification: boolean;
  requireQaApproval: boolean;
}

export interface OjtPlan extends Timestamps, OjtApprovalConfig {
  id: string;
  year: number;
  departmentId: string;
  departmentName?: string;
  topicId: string;
  trainingTopic: string;
  sopId?: string;
  sopNumber?: string;
  sopTitle?: string;
  referenceDocumentNumber?: string;
  selectionMonths: number[];
  executionMonths: number[];
  trainerId?: string;
  trainerName?: string;
  responsiblePersonId?: string;
  responsiblePersonName?: string;
  status: OjtPlanStatus;
  remarks?: string;
  preparedBy?: string;
  preparedByName?: string;
  checkedBy?: string;
  checkedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  effectiveDate?: string;
  revisionNumber?: string;
  employeeSelections: OjtEmployeeSelection[];
}

export interface OjtCriterionScore {
  criterionId: string;
  label: string;
  rating?: number;
  result?: "pass" | "fail" | "na";
  comments?: string;
}

export interface OjtEvaluation {
  criteria: OjtCriterionScore[];
  overallRating?: number;
  overallResult: "pass" | "fail" | "pending";
  comments?: string;
  evaluatedBy?: string;
  evaluatedByName?: string;
  evaluatedAt?: string;
}

export interface OjtAcknowledgement {
  acknowledged: boolean;
  statement: string;
  acknowledgedAt: string;
  userId: string;
  userName: string;
  employeeId: string;
  signatureDataUrl?: string;
}

export interface OjtSignoff {
  signed: boolean;
  decision: "approved" | "rejected";
  comments?: string;
  signedAt: string;
  userId: string;
  userName: string;
  role: UserRole;
  signatureDataUrl?: string;
}

export interface OjtAttachment {
  id: string;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
  kind: OjtAttachmentKind;
}

export interface OjtAttempt {
  id: string;
  attemptNumber: number;
  status: OjtStatus;
  trainerId?: string;
  trainerName?: string;
  executionDate?: string;
  evaluation?: OjtEvaluation;
  outcome: "passed" | "failed" | "in_progress";
  failureReason?: string;
  remarks?: string;
  createdAt: string;
  sopVersionId?: string;
  sopVersionNumber?: string;
}

export interface OjtAssignment extends Timestamps, OjtApprovalConfig {
  id: string;
  planId?: string;
  topicId: string;
  trainingTopic: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentId: string;
  departmentName?: string;
  designation?: string;
  sopId?: string;
  sopNumber?: string;
  sopTitle?: string;
  sopVersionId?: string;
  sopVersionNumber?: string;
  sopEffectiveDate?: string;
  trainedSopVersionId?: string;
  trainedSopVersionNumber?: string;
  sopVersionChangeJustification?: string;
  referenceDocumentNumber?: string;
  year: number;
  selectionMonth: number;
  plannedExecutionMonth: number;
  selectionDate?: string;
  actualExecutionDate?: string;
  executionDeviation?: OjtExecutionDeviation;
  startTime?: string;
  endTime?: string;
  location?: string;
  trainerId?: string;
  trainerName?: string;
  supervisorId?: string;
  supervisorName?: string;
  hodUserId?: string;
  hodUserName?: string;
  qaVerifierId?: string;
  qaVerifierName?: string;
  responsiblePersonId?: string;
  responsiblePersonName?: string;
  status: OjtStatus;
  remarks?: string;
  practicalActivity?: string;
  trainingDetails?: string;
  observations?: string;
  employeePerformance?: string;
  trainerRemarks?: string;
  failureReason?: string;
  retrainingDate?: string;
  overallCompetency?: OjtOverallCompetency;
  evaluation?: OjtEvaluation;
  acknowledgement?: OjtAcknowledgement;
  trainerSignoff?: OjtSignoff;
  hodVerification?: OjtSignoff;
  qaApproval?: OjtSignoff;
  attachments: OjtAttachment[];
  attempts: OjtAttempt[];
  attemptNumber: number;
  previousAssignmentId?: string;
  isRetraining: boolean;
}

export interface OjtEvaluationCriterion extends Timestamps {
  id: string;
  label: string;
  description?: string;
  order: number;
  ratingScale: OjtCriterionScale;
  isActive: boolean;
  isRequired: boolean;
}

export interface OjtFormApprovalConfig {
  requirePreparedBy: boolean;
  requireCheckedByCoordinator: boolean;
  requireVerifiedByHod: boolean;
  requireCheckedByHead: boolean;
  requireApprovedByQa: boolean;
}

export interface OjtSettings extends Timestamps, OjtApprovalConfig {
  id: string;
  overdueGraceDays: number;
  /** Official PDF default: execution month is not earlier than selection month. */
  allowExecutionBeforeSelection: boolean;
  requireExecutionDeviationApproval: boolean;
  competencyScoringModel: OjtCompetencyScoringModel;
  plannerFormNumber: string;
  matrixFormNumber: string;
  companyName: string;
  companyDivision: string;
  plannerApprovals: OjtFormApprovalConfig;
  matrixApprovals: OjtFormApprovalConfig;
}

export interface OjtFormSignoff {
  role: OjtFormSignoffRole;
  action: "prepared" | "checked" | "verified" | "approved" | "rejected";
  userId: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
  comment?: string;
  signatureDataUrl?: string;
}

export interface OjtFormRevision {
  revisionNumber: string;
  effectiveDate: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  reason: string;
  snapshot: Record<string, unknown>;
}

/** Controlled yearly planner / employee-training-matrix document (SOP/QA/002 forms). */
export interface OjtFormDocument extends Timestamps {
  id: string;
  kind: OjtFormKind;
  year: number;
  departmentId: string;
  departmentName?: string;
  effectiveDate: string;
  revisionNumber: string;
  formNumber: string;
  status: OjtFormStatus;
  companyName?: string;
  trainingCoordinatorUserId?: string;
  trainingCoordinatorName?: string;
  signoffs: OjtFormSignoff[];
  revisions: OjtFormRevision[];
  locked: boolean;
}

export interface OjtExecutionDeviation {
  reason: string;
  approvedBy: string;
  approvedByName: string;
  approvalDate: string;
  originalPlannedMonth: number;
  originalYear: number;
  revisedExecutionDate: string;
}

export interface OjtDashboardStats {
  totalTopics: number;
  totalAssigned: number;
  planned: number;
  thisMonth: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  pending: number;
  failed: number;
  retrainingRequired: number;
  overdue: number;
  cancelled: number;
  completionPercent: number;
}

export type OjtActor = {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  departmentId?: string;
  digitalSignatureUrl?: string;
};
