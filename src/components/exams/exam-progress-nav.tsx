"use client";

import { cn } from "@/lib/utils";
import type { AttemptQuestion } from "@/types";

interface ExamProgressNavProps {
  questions: AttemptQuestion[];
  answers: Record<string, string[]>;
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function ExamProgressNav({
  questions,
  answers,
  currentIndex,
  onSelect,
}: ExamProgressNavProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((q, i) => {
        const answered = (answers[q.questionId] || q.selectedOptionIds || []).length > 0;
        return (
          <button
            key={q.questionId}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
              i === currentIndex && "ring-2 ring-primary",
              answered
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-accent"
            )}
            aria-label={`Question ${i + 1}${answered ? " answered" : ""}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
