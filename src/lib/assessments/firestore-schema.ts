/**
 * Firestore structure — Assessment Engine
 *
 * Collections (see COLLECTIONS in src/lib/firebase/client.ts):
 *
 * question_banks/{bankId}
 *   name, description, sopId?, departmentId?, questionCount,
 *   difficultyMix?: { easy, medium, hard }, isActive, timestamps
 *
 * questions/{questionId}
 *   bankId, text, type: mcq|true_false|multi_select|scenario|image,
 *   options[{id,text,isCorrect}], explanation?, difficulty,
 *   marks, negativeMarks?, tags[], sopId?,
 *   scenario?: { title?, narrative, media? },
 *   media?: { type, url, alt?, storagePath? },
 *   isActive, timestamps
 *   NOTE: Employees should not read this collection directly — attempts
 *   are assembled server-side / Cloud Function; correctOptionIds stripped
 *   until submit.
 *
 * exams/{examId}
 *   title, description?, bankId, bankIds?, sopId?, inductionModuleId?,
 *   questionCount, durationMinutes, passPercentage,
 *   shuffleQuestions, shuffleOptions, randomizeFromBank,
 *   difficultyMix?, negativeMarkingEnabled, defaultNegativeMarks?,
 *   maxAttempts, showResultsImmediately, autoSaveEnabled,
 *   autoSaveIntervalSeconds?, autoSubmitOnTimeout, allowReview,
 *   certificatePassPercentage?, leaderboardEnabled, isActive, timestamps
 *
 * assessment_attempts/{attemptId}
 *   examId, examTitle?, employeeId, employeeName?,
 *   assignmentId?, inductionAssignmentId?,
 *   status: not_started|in_progress|passed|failed|expired,
 *   startedAt, submittedAt?, expiresAt, lastSavedAt?,
 *   questions[AttemptQuestion], answersDraft?,
 *   score?, maxScore?, percentage?, passed?, certificateEligible?,
 *   negativeMarksApplied?, timeSpentSeconds?, rank?, timestamps
 *
 * exam_results/{resultId}  (slim — analytics / leaderboard)
 *   attemptId, examId, examTitle, employeeId, employeeName,
 *   percentage, score, maxScore, passed, certificateEligible,
 *   timeSpentSeconds, rank?, difficultyBreakdown?, typeBreakdown?,
 *   timestamps
 *   Writes: Cloud Functions / Admin SDK only (rules: write false)
 *
 * exam_leaderboards/{examId}  (optional aggregate cache)
 *   entries: LeaderboardEntry[], updatedAt
 *   Writes: Cloud Functions only
 *
 * Indexes: bankId+isActive, bankId+difficulty+isActive,
 *   examId+employeeId+startedAt, examId+status+percentage,
 *   examId+percentage (results), examId+employeeId+submittedAt
 */
export {};
