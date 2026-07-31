"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  BarChart3,
  Loader2,
  Play,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useExamAnalytics, useExamLeaderboard, useExams, useQuestionBank } from "@/hooks/use-assessment";
import {
  autoSaveAssessment,
  deleteExam,
  getAttempt,
  getExam,
  startAssessment,
  submitAssessment,
} from "@/lib/services/assessments";
import { ExamTimer } from "@/components/exams/exam-timer";
import { ExamProgressNav } from "@/components/exams/exam-progress-nav";
import { QuestionRenderer } from "@/components/exams/question-renderer";
import { AnswerReview } from "@/components/exams/answer-review";
import { ExamResultSummary } from "@/components/exams/exam-result-summary";
import { LeaderboardTable } from "@/components/exams/leaderboard-table";
import { AssessmentAnalyticsPanel } from "@/components/exams/assessment-analytics-panel";
import { RequirePermission } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { AiExamBlueprintDialog } from "@/components/ai/ai-exam-blueprint-dialog";
import { CreateExamDialog } from "@/components/exams/create-exam-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssessmentAttempt, Exam } from "@/types";

type Phase = "list" | "exam" | "result" | "review";

function ExamsPageInner() {
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { exams, loading: examsLoading, refresh: refreshExams } = useExams();
  const { banks } = useQuestionBank();

  const [phase, setPhase] = useState<Phase>("list");
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const submittingRef = useRef(false);

  const { entries: leaderboard } = useExamLeaderboard(
    phase === "list" || phase === "result" ? selectedExamId : undefined
  );
  const { analytics } = useExamAnalytics(
    phase === "list" ? selectedExamId : undefined
  );

  const startExam = useCallback(
    async (examId: string, inductionAssignmentId?: string | null) => {
      if (!profile?.employeeId && !profile?.uid) {
        toast.error("Sign in as an employee-linked user to take exams");
        return;
      }
      setBusy(true);
      try {
        const examDoc = await getExam(examId);
        if (!examDoc) throw new Error("Exam not found");
        const started = await startAssessment({
          examId,
          employeeId: profile.employeeId || profile.uid,
          employeeName: profile.displayName,
          inductionAssignmentId: inductionAssignmentId || undefined,
        });
        setExam(examDoc);
        setAttempt(started);
        setAnswers(started.answersDraft || {});
        setCurrentIndex(0);
        setLastSavedAt(started.lastSavedAt || null);
        setSelectedExamId(examId);
        setPhase("exam");
        toast.success("Exam started — answers autosave while you work");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not start exam");
      } finally {
        setBusy(false);
      }
    },
    [profile]
  );

  useEffect(() => {
    const examParam = searchParams.get("exam");
    const inda = searchParams.get("inda");
    if (examParam && phase === "list" && profile) {
      void startExam(examParam, inda);
    }
  }, [searchParams, phase, profile, startExam]);

  // Autosave
  useEffect(() => {
    if (phase !== "exam" || !attempt || !exam?.autoSaveEnabled || !profile) return;
    const interval = (exam.autoSaveIntervalSeconds || 15) * 1000;
    const id = setInterval(() => {
      setSaving(true);
      void autoSaveAssessment(attempt.id, answers, profile.uid)
        .then(() => setLastSavedAt(new Date().toISOString()))
        .finally(() => setSaving(false));
    }, interval);
    return () => clearInterval(id);
  }, [phase, attempt, exam, answers, profile]);

  const setAnswer = (questionId: string, optionIds: string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIds }));
  };

  const handleSubmit = useCallback(async () => {
    if (!attempt || !profile || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      const result = await submitAssessment(attempt.id, answers, profile.uid);
      // Reload with answers revealed
      const full = await getAttempt(result.id, { revealAnswers: true });
      setAttempt(full || result);
      if (exam?.showResultsImmediately) {
        setPhase("result");
      } else {
        setPhase("list");
        toast.message("Submitted — results will be released by QA");
      }
      if (result.passed) {
        toast.success(`Passed with ${result.percentage}%`);
      } else {
        toast.error(`Score ${result.percentage}% — below pass mark`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }, [attempt, answers, profile, exam]);

  const onExpire = useCallback(() => {
    if (!exam?.autoSubmitOnTimeout) {
      toast.warning("Time expired");
      return;
    }
    toast.warning("Time expired — auto-submitting");
    void handleSubmit();
  }, [exam, handleSubmit]);

  const answeredCount = useMemo(() => {
    if (!attempt) return 0;
    return attempt.questions.filter(
      (q) => (answers[q.questionId] || []).length > 0
    ).length;
  }, [attempt, answers]);

  if (phase === "review" && attempt) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Review answers</h1>
          <Button variant="outline" onClick={() => setPhase("result")}>
            Back to result
          </Button>
        </div>
        <AnswerReview questions={attempt.questions} />
      </div>
    );
  }

  if (phase === "result" && attempt && exam) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <ExamResultSummary
          attempt={attempt}
          exam={exam}
          onReview={exam.allowReview ? () => setPhase("review") : undefined}
          leaderboardHref={exam.leaderboardEnabled ? "#leaderboard" : undefined}
        />
        {exam.leaderboardEnabled && (
          <div id="leaderboard">
            <LeaderboardTable
              entries={leaderboard}
              examTitle={exam.title}
              highlightEmployeeId={attempt.employeeId}
            />
          </div>
        )}
      </div>
    );
  }

  if (phase === "exam" && attempt && exam) {
    const q = attempt.questions[currentIndex];
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{exam.title}</h1>
            <p className="text-sm text-muted-foreground">
              {answeredCount}/{attempt.questions.length} answered · Pass ≥{" "}
              {exam.passPercentage}%
              {exam.negativeMarkingEnabled && " · Negative marking on"}
            </p>
          </div>
          <ExamTimer
            expiresAt={attempt.expiresAt}
            onExpire={onExpire}
            lastSavedAt={lastSavedAt}
            saving={saving}
          />
        </div>

        <Progress
          value={(answeredCount / Math.max(attempt.questions.length, 1)) * 100}
        />

        <ExamProgressNav
          questions={attempt.questions}
          answers={answers}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
        />

        {q && (
          <QuestionRenderer
            question={q}
            index={currentIndex}
            selected={answers[q.questionId] || []}
            onChange={(ids) => setAnswer(q.questionId, ids)}
          />
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <Button
            variant="outline"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          >
            Previous
          </Button>
          <div className="flex gap-2">
            {currentIndex < attempt.questions.length - 1 ? (
              <Button onClick={() => setCurrentIndex((i) => i + 1)}>Next</Button>
            ) : (
              <Button disabled={busy} onClick={() => void handleSubmit()}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit assessment
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <RequirePermission permission={["assessments:take", "exams:read", "assessments:read"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Assessment engine</h1>
            <p className="text-muted-foreground">
              Timed exams · question banks · autosave · analytics · certificates
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CreateExamDialog banks={banks} onCreated={refreshExams} />
            <AiExamBlueprintDialog banks={banks} onSaved={refreshExams} />
          </div>
        </div>

        <Tabs defaultValue="exams">
          <TabsList>
            <TabsTrigger value="exams">Exams</TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Trophy className="mr-1.5 h-3.5 w-3.5" /> Leaderboard
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams" className="space-y-4">
            {examsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading exams…
              </div>
            ) : exams.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="font-medium">No exams yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create an exam manually or generate a blueprint with AI.
                  </p>
                  <CreateExamDialog banks={banks} onCreated={refreshExams} />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {exams.map((e) => (
                  <Card
                    key={e.id}
                    className={
                      selectedExamId === e.id ? "ring-1 ring-primary/40" : undefined
                    }
                    onClick={() => setSelectedExamId(e.id)}
                  >
                    <CardHeader>
                      <div className="flex flex-wrap gap-1.5">
                        {e.negativeMarkingEnabled && (
                          <Badge variant="outline">Negative marking</Badge>
                        )}
                        {e.shuffleQuestions && (
                          <Badge variant="outline">Random Q</Badge>
                        )}
                        {e.shuffleOptions && (
                          <Badge variant="outline">Shuffle options</Badge>
                        )}
                        {e.autoSaveEnabled && (
                          <Badge variant="outline">Autosave</Badge>
                        )}
                      </div>
                      <CardTitle className="text-base">{e.title}</CardTitle>
                      <CardDescription>{e.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        {e.questionCount} Q · {e.durationMinutes} min · Pass{" "}
                        {e.passPercentage}% · Max {e.maxAttempts} attempts
                      </div>
                      <div className="flex items-center gap-1">
                        <AdminDeleteButton
                          confirmTitle={`Delete exam “${e.title}”?`}
                          confirmDescription="This exam and related attempts/results will be removed permanently."
                          successMessage="Exam deleted"
                          onDelete={async () => {
                            await deleteExam(e.id);
                            await refreshExams();
                            if (selectedExamId === e.id) {
                              setSelectedExamId("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            void startExam(e.id);
                          }}
                        >
                          <Play className="mr-1.5 h-3.5 w-3.5" />
                          Start
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Manage items in{" "}
              <Link href="/dashboard/questions" className="underline">
                Question Bank
              </Link>
              .
            </p>
          </TabsContent>

          <TabsContent value="leaderboard">
            <div className="mb-3 flex flex-wrap gap-2">
              {exams.map((e) => (
                <Button
                  key={e.id}
                  size="sm"
                  variant={selectedExamId === e.id ? "default" : "outline"}
                  onClick={() => setSelectedExamId(e.id)}
                >
                  {e.title}
                </Button>
              ))}
            </div>
            <LeaderboardTable
              entries={leaderboard}
              examTitle={exams.find((e) => e.id === selectedExamId)?.title}
              highlightEmployeeId={profile?.employeeId}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="mb-3 flex flex-wrap gap-2">
              {exams.map((e) => (
                <Button
                  key={e.id}
                  size="sm"
                  variant={selectedExamId === e.id ? "default" : "outline"}
                  onClick={() => setSelectedExamId(e.id)}
                >
                  {e.title}
                </Button>
              ))}
            </div>
            {analytics ? (
              <AssessmentAnalyticsPanel analytics={analytics} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete an exam to populate analytics.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </RequirePermission>
  );
}

export default function ExamsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading exams…</div>}>
      <ExamsPageInner />
    </Suspense>
  );
}
