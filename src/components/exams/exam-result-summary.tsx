"use client";

import Link from "next/link";
import { Award, Ban, CheckCircle2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AssessmentAttempt, Exam } from "@/types";

interface ExamResultSummaryProps {
  attempt: AssessmentAttempt;
  exam: Exam;
  onReview?: () => void;
  leaderboardHref?: string;
}

export function CertificateEligibilityBadge({
  eligible,
  threshold,
}: {
  eligible?: boolean;
  threshold?: number;
}) {
  if (eligible) {
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
        <Award className="h-3 w-3" /> Certificate eligible
        {threshold != null && ` (≥${threshold}%)`}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Ban className="h-3 w-3" /> Not certificate eligible
      {threshold != null && ` (need ≥${threshold}%)`}
    </Badge>
  );
}

export function ExamResultSummary({
  attempt,
  exam,
  onReview,
  leaderboardHref,
}: ExamResultSummaryProps) {
  const passed = !!attempt.passed;

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Assessment result</CardTitle>
        <CardDescription>{attempt.examTitle || exam.title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-center">
        <p className="text-5xl font-bold tracking-tight">{attempt.percentage}%</p>
        <p
          className={
            passed ? "font-semibold text-emerald-600" : "font-semibold text-destructive"
          }
        >
          {attempt.status === "expired" ? "EXPIRED" : passed ? "PASSED" : "FAILED"}
        </p>

        <div className="flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
          <span>
            Score {attempt.score}/{attempt.maxScore}
          </span>
          {attempt.negativeMarksApplied ? (
            <span>· Penalty −{attempt.negativeMarksApplied}</span>
          ) : null}
          {attempt.rank ? (
            <span className="inline-flex items-center gap-1">
              · <Trophy className="h-3.5 w-3.5" /> Rank #{attempt.rank}
            </span>
          ) : null}
        </div>

        <div className="flex justify-center">
          <CertificateEligibilityBadge
            eligible={attempt.certificateEligible}
            threshold={exam.certificatePassPercentage ?? exam.passPercentage}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          Pass mark: {exam.passPercentage}%
          {!passed && exam.autoSubmitOnTimeout && attempt.status === "expired"
            ? " · Auto-submitted on timeout"
            : null}
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          {exam.allowReview && onReview && (
            <Button variant="outline" onClick={onReview}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Review answers
            </Button>
          )}
          {attempt.certificateEligible && (
            <Button variant="outline" asChild>
              <Link href="/dashboard/certificates">View certificate</Link>
            </Button>
          )}
          {leaderboardHref && exam.leaderboardEnabled && (
            <Button variant="outline" asChild>
              <Link href={leaderboardHref}>Leaderboard</Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/dashboard/exams">Back to exams</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
