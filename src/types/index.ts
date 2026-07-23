/**
 * PharmaLMS — Core Domain Types
 * Normalized Firestore document models for audit-compliant training workflows.
 */

export type UserRole =
  | "super_admin"
  | "hr"
  | "qa"
  | "department_head"
  | "trainer"
  | "employee";

export type EmployeeStatus =
  | "draft"
  | "induction"
  | "induction_complete"
  | "handed_over"
  | "active"
  | "inactive"
  | "terminated";

export type InductionStatus =
  | "not_started"
  | "in_progress"
  | "assessment_pending"
  | "passed"
  | "failed";

export type TrainingAssignmentStatus =
  | "assigned"
  | "in_progress"
  | "training_scheduled"
  | "training_completed"
  | "assessment_pending"
  | "passed"
  | "failed"
  | "retraining"
  | "expired";

export type SopStatus = "draft" | "under_review" | "approved" | "obsolete" | "superseded";

export type AssessmentStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "passed"
  | "failed"
  | "expired";

export type NotificationType =
  | "assignment"
  | "reminder"
  | "assessment"
  | "certificate"
  | "sop_revision"
  | "handover"
  | "retraining"
  | "system";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "assign"
  | "approve"
  | "reject"
  | "submit"
  | "login"
  | "logout"
  | "upload"
  | "download"
  | "export"
  | "sign"
  | "reassign";

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export interface UserProfile extends Timestamps {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  employeeId?: string;
  departmentId?: string;
  photoURL?: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  digitalSignatureUrl?: string;
}

export interface Department extends Timestamps {
  id: string;
  code: string;
  name: string;
  description?: string;
  headUserId?: string;
  parentDepartmentId?: string;
  isActive: boolean;
}

export interface Employee extends Timestamps {
  id: string;
  employeeCode: string;
  userId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfJoining: string;
  designation: string;
  departmentId?: string;
  reportingManagerId?: string;
  status: EmployeeStatus;
  inductionStatus: InductionStatus;
  inductionCompletedAt?: string;
  handedOverAt?: string;
  handedOverBy?: string;
  photoURL?: string;
  address?: string;
  emergencyContact?: string;
  metadata?: Record<string, string>;
}

export interface InductionModule extends Timestamps {
  id: string;
  title: string;
  description: string;
  order: number;
  isMandatory: boolean;
  estimatedMinutes: number;
  isActive: boolean;
  documents: InductionDocument[];
  assessmentId?: string;
  passPercentage: number;
}

export interface InductionDocument {
  id: string;
  title: string;
  type: "pdf" | "ppt" | "video" | "other";
  storagePath: string;
  downloadUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface InductionAssignment extends Timestamps {
  id: string;
  employeeId: string;
  moduleId: string;
  status: InductionStatus;
  progressPercent: number;
  documentsViewed: string[];
  startedAt?: string;
  completedAt?: string;
  assessmentAttemptId?: string;
  score?: number;
  passed?: boolean;
}

export interface JobDescription extends Timestamps {
  id: string;
  employeeId: string;
  departmentId: string;
  title: string;
  version: number;
  responsibilities: string[];
  qualifications: string[];
  skills: string[];
  reportingTo?: string;
  status: "draft" | "approved" | "obsolete";
  approvedBy?: string;
  approvedAt?: string;
  effectiveFrom: string;
}

export interface TrainingNeedItem {
  id: string;
  topic: string;
  sopId?: string;
  priority: "low" | "medium" | "high" | "critical";
  rationale: string;
  targetCompletionDate?: string;
  status: "identified" | "assigned" | "completed" | "deferred";
}

export interface TrainingNeedIdentification extends Timestamps {
  id: string;
  employeeId: string;
  departmentId: string;
  jdId: string;
  version: number;
  needs: TrainingNeedItem[];
  status: "draft" | "submitted" | "approved" | "in_progress" | "completed";
  approvedBy?: string;
  approvedAt?: string;
}

export interface SopDocument extends Timestamps {
  id: string;
  sopNumber: string;
  title: string;
  description: string;
  departmentIds: string[];
  category: string;
  currentVersionId: string;
  status: SopStatus;
  tags: string[];
  effectiveDate?: string;
  reviewDate?: string;
  ownerUserId: string;
}

export interface SopVersion extends Timestamps {
  id: string;
  sopId: string;
  versionNumber: string;
  major: number;
  minor: number;
  changeSummary: string;
  storagePath: string;
  downloadUrl: string;
  fileSize: number;
  mimeType: string;
  status: SopStatus;
  approvedBy?: string;
  approvedAt?: string;
  obsoleteReason?: string;
  supersedesVersionId?: string;
}

export interface TrainerProfile extends Timestamps {
  id: string;
  userId: string;
  employeeId?: string;
  specializations: string[];
  departmentIds: string[];
  qualifications: string[];
  isActive: boolean;
  totalSessionsConducted: number;
}

export interface TrainingSession extends Timestamps {
  id: string;
  title: string;
  description?: string;
  sopId?: string;
  sopVersionId?: string;
  trainerId: string;
  departmentId: string;
  scheduledAt: string;
  durationMinutes: number;
  location?: string;
  mode: "classroom" | "online" | "on_job" | "self_paced";
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  attendance: TrainingAttendance[];
  materials: InductionDocument[];
  completedAt?: string;
  notes?: string;
}

export interface TrainingAttendance {
  employeeId: string;
  present: boolean;
  signedAt?: string;
  signatureUrl?: string;
  remarks?: string;
}

export interface TrainingAssignment extends Timestamps {
  id: string;
  employeeId: string;
  sopId: string;
  sopVersionId: string;
  sessionId?: string;
  trainerId?: string;
  assignedBy: string;
  departmentId: string;
  status: TrainingAssignmentStatus;
  dueDate?: string;
  startedAt?: string;
  trainingCompletedAt?: string;
  assessmentAttemptId?: string;
  certificateId?: string;
  score?: number;
  passed?: boolean;
  attemptCount: number;
  isRetraining: boolean;
  previousAssignmentId?: string;
  triggeredBySopRevision?: boolean;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question extends Timestamps {
  id: string;
  bankId: string;
  text: string;
  type: "mcq" | "true_false" | "multi_select";
  options: QuestionOption[];
  explanation?: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  tags: string[];
  sopId?: string;
  isActive: boolean;
}

export interface QuestionBank extends Timestamps {
  id: string;
  name: string;
  description?: string;
  sopId?: string;
  departmentId?: string;
  questionCount: number;
  isActive: boolean;
}

export interface Exam extends Timestamps {
  id: string;
  title: string;
  description?: string;
  bankId: string;
  sopId?: string;
  inductionModuleId?: string;
  questionCount: number;
  durationMinutes: number;
  passPercentage: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxAttempts: number;
  showResultsImmediately: boolean;
  isActive: boolean;
}

export interface AssessmentAttempt extends Timestamps {
  id: string;
  examId: string;
  employeeId: string;
  assignmentId?: string;
  inductionAssignmentId?: string;
  status: AssessmentStatus;
  startedAt: string;
  submittedAt?: string;
  expiresAt: string;
  questions: AttemptQuestion[];
  score?: number;
  percentage?: number;
  passed?: boolean;
  timeSpentSeconds?: number;
  ipAddress?: string;
}

export interface AttemptQuestion {
  questionId: string;
  text: string;
  type: Question["type"];
  options: { id: string; text: string }[];
  selectedOptionIds: string[];
  correctOptionIds: string[];
  marks: number;
  earnedMarks: number;
  isCorrect: boolean;
}

export interface Certificate extends Timestamps {
  id: string;
  certificateNumber: string;
  employeeId: string;
  trainingAssignmentId: string;
  sopId: string;
  sopVersionId: string;
  examId: string;
  attemptId: string;
  title: string;
  issuedAt: string;
  expiresAt?: string;
  score: number;
  percentage: number;
  trainerId?: string;
  digitalSignatureUrl?: string;
  signedBy?: string;
  qrCodeData: string;
  pdfStoragePath?: string;
  pdfDownloadUrl?: string;
  verificationHash: string;
  isRevoked: boolean;
  revokedReason?: string;
}

export interface Notification extends Timestamps {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: string;
  metadata?: Record<string, string>;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorEmail: string;
  actorRole: UserRole;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface TrainingMatrixEntry {
  employeeId: string;
  employeeName: string;
  departmentId: string;
  sopId: string;
  sopNumber: string;
  sopTitle: string;
  status: TrainingAssignmentStatus | "not_assigned";
  score?: number;
  completedAt?: string;
  certificateId?: string;
  version: string;
}

export interface DashboardStats {
  totalEmployees: number;
  activeTrainings: number;
  pendingAssessments: number;
  complianceRate: number;
  certificatesIssued: number;
  overdueTrainings: number;
  sopRevisionsThisMonth: number;
  inductionInProgress: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
