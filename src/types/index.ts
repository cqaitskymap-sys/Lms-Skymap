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
  | "pending_verification"
  | "verified"
  | "induction"
  | "induction_complete"
  | "handed_over"
  | "active"
  | "qualified"
  | "inactive"
  | "terminated";

/** Fine-grained onboarding → qualification pipeline */
export type LifecycleStage =
  | "created"
  | "hr_verification"
  | "induction_assigned"
  | "induction_completed"
  | "department_handover"
  | "jd_created"
  | "tni_created"
  | "trainer_assigned"
  | "sop_assigned"
  | "training"
  | "exam"
  | "passed"
  | "certified"
  | "qualified";

export type LifecycleEventStatus = "completed" | "current" | "upcoming" | "blocked" | "rejected";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalType =
  | "hr_verification"
  | "induction_completion"
  | "department_handover"
  | "jd_approval"
  | "tni_approval"
  | "training_completion"
  | "certificate_issue";

export interface LifecycleEvent {
  id: string;
  employeeId: string;
  stage: LifecycleStage;
  title: string;
  description: string;
  status: LifecycleEventStatus;
  actorId?: string;
  actorName?: string;
  actorRole?: UserRole;
  completedAt?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface LifecycleApproval {
  id: string;
  employeeId: string;
  type: ApprovalType;
  title: string;
  description: string;
  status: ApprovalStatus;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  comments?: string;
  stage: LifecycleStage;
}

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

/** Employment classification captured during HR onboarding */
export type EmploymentType =
  | "permanent"
  | "contract"
  | "intern"
  | "consultant"
  | "temporary";

/** First-login / account provisioning gate for new hires */
export type OnboardingStatus =
  | "pending_first_login"
  | "in_progress"
  | "completed";

export interface UserProfile extends Timestamps {
  id: string;
  uid: string;
  email: string;
  /** Login username — equals employee code when provisioned by HR */
  username?: string;
  displayName: string;
  role: UserRole;
  roleId?: string;
  employeeId?: string;
  departmentId?: string;
  photoURL?: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  digitalSignatureUrl?: string;
  /** Force password change on next login (set by HR/Admin). */
  mustChangePassword?: boolean;
  passwordChangedAt?: string;
  /** Force profile completion after first login */
  mustUpdateProfile?: boolean;
  /** Force acceptance of current company policies */
  mustAcceptPolicies?: boolean;
  policiesAcceptedAt?: string;
  policiesVersion?: string;
  onboardingCompletedAt?: string;
}

export interface LoginLockout {
  id: string;
  emailNormalized: string;
  failedAttempts: number;
  lockedUntil: string | null;
  lastFailedAt?: string;
  lastSuccessAt?: string;
  updatedAt: string;
}

export type ActivityVerb =
  | "login_success"
  | "login_failed"
  | "logout"
  | "password_reset_requested"
  | "password_changed"
  | "profile_updated"
  | "session_expired"
  | "account_locked"
  | "viewed_page"
  | "lifecycle_advanced"
  | "approval_reviewed"
  | "employee_created"
  | "account_provisioned"
  | "credentials_emailed"
  | "policies_accepted"
  | "onboarding_completed";

export interface ActivityLog {
  id: string;
  userId: string;
  employeeId?: string;
  verb: ActivityVerb;
  summary: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, string>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
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
  /** Login username — always equals employeeCode after provisioning */
  username?: string;
  userId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  mobile?: string;
  dateOfJoining: string;
  designation: string;
  departmentId?: string;
  departmentName?: string;
  reportingManagerId?: string;
  reportingManagerName?: string;
  employmentType?: EmploymentType;
  status: EmployeeStatus;
  /** Fine-grained lifecycle stage for the qualification pipeline */
  lifecycleStage: LifecycleStage;
  /** 0–100 derived from lifecycle stage */
  lifecycleProgress: number;
  inductionStatus: InductionStatus;
  inductionCompletedAt?: string;
  handedOverAt?: string;
  handedOverBy?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  qualifiedAt?: string;
  jdId?: string;
  tniId?: string;
  currentTrainerId?: string;
  photoURL?: string;
  address?: string;
  emergencyContact?: string;
  /** Auth + first-login onboarding gate */
  onboardingStatus?: OnboardingStatus;
  accountProvisionedAt?: string;
  credentialsEmailedAt?: string;
  credentialsEmailedTo?: string;
  metadata?: Record<string, string>;
}

/** Company policy presented during first-login onboarding */
export interface CompanyPolicy extends Timestamps {
  id: string;
  version: string;
  title: string;
  summary: string;
  content: string;
  isRequired: boolean;
  isActive: boolean;
  order: number;
}

export interface PolicyAcceptance {
  id: string;
  userId: string;
  employeeId?: string;
  policyId: string;
  policyVersion: string;
  acceptedAt: string;
  ipAddress?: string;
  userAgent?: string;
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
  /** Denormalized current version label e.g. "1.2" */
  currentVersionNumber?: string;
  viewCount?: number;
  acknowledgementCount?: number;
  archivedAt?: string;
}

export type SopAttachmentType = "pdf" | "video" | "ppt" | "other";

export interface SopAttachment {
  id: string;
  type: SopAttachmentType;
  title: string;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface SopVersion extends Timestamps {
  id: string;
  sopId: string;
  versionNumber: string;
  major: number;
  minor: number;
  changeSummary: string;
  /** Primary PDF path (convenience; also in attachments) */
  storagePath: string;
  downloadUrl: string;
  fileSize: number;
  mimeType: string;
  status: SopStatus;
  attachments: SopAttachment[];
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  submittedForReviewAt?: string;
  submittedBy?: string;
  obsoleteReason?: string;
  supersedesVersionId?: string;
  archivedAt?: string;
  effectiveDate?: string;
  reviewDate?: string;
  viewCount?: number;
  acknowledgementCount?: number;
  retrainAssignedCount?: number;
}

export interface SopViewRecord {
  id: string;
  sopId: string;
  versionId: string;
  versionNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  employeeId?: string;
  viewedAt: string;
  durationSeconds?: number;
  source: "preview" | "download" | "acknowledge";
}

export interface SopAcknowledgement {
  id: string;
  sopId: string;
  versionId: string;
  versionNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  employeeId?: string;
  acknowledgedAt: string;
  statement: string;
  signatureDataUrl?: string;
  ipAddress?: string;
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

export type QuestionType =
  | "mcq"
  | "true_false"
  | "multi_select"
  | "scenario"
  | "image";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionMedia {
  type: "image" | "diagram";
  url: string;
  alt?: string;
  storagePath?: string;
}

/** Scenario stem + optional supporting media before the actual question. */
export interface QuestionScenario {
  title?: string;
  narrative: string;
  media?: QuestionMedia;
}

export interface Question extends Timestamps {
  id: string;
  bankId: string;
  text: string;
  type: QuestionType;
  options: QuestionOption[];
  explanation?: string;
  difficulty: QuestionDifficulty;
  /** Positive marks awarded when fully correct */
  marks: number;
  /** Penalty deducted when answered incorrectly (0 = no negative marking) */
  negativeMarks?: number;
  tags: string[];
  sopId?: string;
  scenario?: QuestionScenario;
  media?: QuestionMedia;
  isActive: boolean;
}

export interface QuestionBank extends Timestamps {
  id: string;
  name: string;
  description?: string;
  sopId?: string;
  departmentId?: string;
  questionCount: number;
  difficultyMix?: Partial<Record<QuestionDifficulty, number>>;
  isActive: boolean;
}

export interface Exam extends Timestamps {
  id: string;
  title: string;
  description?: string;
  bankId: string;
  /** Optional extra banks pooled when randomizing */
  bankIds?: string[];
  sopId?: string;
  inductionModuleId?: string;
  questionCount: number;
  durationMinutes: number;
  passPercentage: number;
  /** Randomize question order from bank */
  shuffleQuestions: boolean;
  /** Randomize option order per question */
  shuffleOptions: boolean;
  /** Prefer random subset matching difficultyMix when set */
  randomizeFromBank: boolean;
  difficultyMix?: Partial<Record<QuestionDifficulty, number>>;
  /** Apply per-question negativeMarks (or exam-level default) */
  negativeMarkingEnabled: boolean;
  defaultNegativeMarks?: number;
  maxAttempts: number;
  showResultsImmediately: boolean;
  /** Persist answers periodically while in progress */
  autoSaveEnabled: boolean;
  autoSaveIntervalSeconds?: number;
  /** Submit when timer hits zero */
  autoSubmitOnTimeout: boolean;
  /** Allow post-submit answer review */
  allowReview: boolean;
  /** Percentage / pass required for certificate eligibility */
  certificatePassPercentage?: number;
  leaderboardEnabled: boolean;
  isActive: boolean;
}

export interface AssessmentAttempt extends Timestamps {
  id: string;
  examId: string;
  examTitle?: string;
  employeeId: string;
  employeeName?: string;
  assignmentId?: string;
  inductionAssignmentId?: string;
  status: AssessmentStatus;
  startedAt: string;
  submittedAt?: string;
  expiresAt: string;
  lastSavedAt?: string;
  questions: AttemptQuestion[];
  /** Running answers map mirrored for autosave */
  answersDraft?: Record<string, string[]>;
  score?: number;
  maxScore?: number;
  percentage?: number;
  passed?: boolean;
  certificateEligible?: boolean;
  negativeMarksApplied?: number;
  timeSpentSeconds?: number;
  ipAddress?: string;
  rank?: number;
}

export interface AttemptQuestion {
  questionId: string;
  text: string;
  type: QuestionType;
  options: { id: string; text: string }[];
  selectedOptionIds: string[];
  /** Omitted / empty while in_progress for client security; filled after score */
  correctOptionIds: string[];
  marks: number;
  negativeMarks: number;
  earnedMarks: number;
  isCorrect: boolean;
  isAnswered: boolean;
  explanation?: string;
  scenario?: QuestionScenario;
  media?: QuestionMedia;
  difficulty: QuestionDifficulty;
}

/** Slim scored result for analytics / leaderboard (no full question payload). */
export interface ExamResult extends Timestamps {
  id: string;
  attemptId: string;
  examId: string;
  examTitle: string;
  employeeId: string;
  employeeName: string;
  percentage: number;
  score: number;
  maxScore: number;
  passed: boolean;
  certificateEligible: boolean;
  timeSpentSeconds: number;
  rank?: number;
  difficultyBreakdown?: Record<QuestionDifficulty, { correct: number; total: number }>;
  typeBreakdown?: Partial<Record<QuestionType, { correct: number; total: number }>>;
}

export interface LeaderboardEntry {
  rank: number;
  employeeId: string;
  employeeName: string;
  percentage: number;
  score: number;
  timeSpentSeconds: number;
  passed: boolean;
  submittedAt: string;
  attemptId: string;
}

export interface AssessmentAnalytics {
  examId: string;
  examTitle: string;
  attemptCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
  averagePercentage: number;
  averageTimeSeconds: number;
  certificateEligibleCount: number;
  difficultyAccuracy: Record<QuestionDifficulty, number>;
  typeAccuracy: Partial<Record<QuestionType, number>>;
  scoreDistribution: { bucket: string; count: number }[];
  topMissedQuestionIds: { questionId: string; missRate: number; text: string }[];
}

export interface Certificate extends Timestamps {
  id: string;
  certificateNumber: string;
  employeeId: string;
  /** Denormalized for display / verification offline */
  employeeName: string;
  employeeCode: string;
  departmentId?: string;
  departmentName: string;
  trainingAssignmentId: string;
  sopId: string;
  sopVersionId: string;
  sopNumber: string;
  sopTitle: string;
  examId: string;
  attemptId: string;
  title: string;
  issuedAt: string;
  expiresAt?: string;
  score: number;
  percentage: number;
  trainerId?: string;
  trainerName: string;
  companyName: string;
  companyLogoUrl?: string;
  digitalSignatureUrl?: string;
  signedBy?: string;
  signedByTitle?: string;
  qrCodeData: string;
  qrCodeImageUrl?: string;
  pdfStoragePath?: string;
  pdfDownloadUrl?: string;
  verificationHash: string;
  isRevoked: boolean;
  revokedReason?: string;
}

/** Public-safe payload returned by verification API / page */
export interface CertificateVerification {
  valid: boolean;
  revoked?: boolean;
  certificateNumber?: string;
  employeeName?: string;
  employeeCode?: string;
  departmentName?: string;
  trainerName?: string;
  sopNumber?: string;
  sopTitle?: string;
  issuedAt?: string;
  percentage?: number;
  companyName?: string;
  verificationHash?: string;
  message: string;
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
