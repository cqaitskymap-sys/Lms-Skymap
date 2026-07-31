"use client";

import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { QuestionRenderer } from "@/components/exams/question-renderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttemptQuestion } from "@/types";

interface AnswerReviewProps {
  questions: AttemptQuestion[];
}

export function AnswerReview({ questions }: AnswerReviewProps) {
  const correct = questions.filter((q) => q.isCorrect).length;
  const unanswered = questions.filter((q) => !q.isAnswered).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Answer review</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> {correct} correct
          </span>
          <span className="inline-flex items-center gap-1.5 text-destructive">
            <XCircle className="h-4 w-4" /> {questions.length - correct - unanswered} incorrect
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <MinusCircle className="h-4 w-4" /> {unanswered} unanswered
          </span>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <QuestionRenderer
            key={q.questionId}
            question={q}
            index={i}
            selected={q.selectedOptionIds}
            onChange={() => undefined}
            disabled
            review
          />
        ))}
      </div>
    </div>
  );
}
