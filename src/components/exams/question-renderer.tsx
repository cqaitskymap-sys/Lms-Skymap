"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AttemptQuestion, QuestionType } from "@/types";

const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "Multiple choice",
  true_false: "True / False",
  multi_select: "Multiple select",
  scenario: "Scenario",
  image: "Image",
};

interface QuestionRendererProps {
  question: AttemptQuestion;
  index: number;
  selected: string[];
  onChange: (optionIds: string[]) => void;
  disabled?: boolean;
  /** Review mode: show correct/incorrect highlighting */
  review?: boolean;
}

export function QuestionRenderer({
  question,
  index,
  selected,
  onChange,
  disabled,
  review,
}: QuestionRendererProps) {
  const [failedMediaUrl, setFailedMediaUrl] = useState("");
  const multi = question.type === "multi_select";
  const options = question.options || [];
  const correctIds = question.correctOptionIds || [];
  const chosen = selected || [];

  const toggle = (oid: string) => {
    if (disabled) return;
    if (multi) {
      onChange(
        chosen.includes(oid) ? chosen.filter((x) => x !== oid) : [...chosen, oid]
      );
    } else {
      onChange([oid]);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TYPE_LABEL[question.type]}</Badge>
          <Badge variant="outline" className="capitalize">
            {question.difficulty}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {question.marks} mark{question.marks !== 1 ? "s" : ""}
            {question.negativeMarks > 0 && ` · −${question.negativeMarks} if wrong`}
          </span>
        </div>
        {question.scenario && (
          <div className="mt-3 rounded-md border bg-muted/40 p-3 text-left">
            {question.scenario.title && (
              <p className="text-sm font-semibold">{question.scenario.title}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
              {question.scenario.narrative}
            </p>
          </div>
        )}
        <CardTitle className="text-base pt-2">
          Q{index + 1}. {question.text}
        </CardTitle>
        {multi && (
          <CardDescription>Select all that apply</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {question.media?.url && (
          <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
            {failedMediaUrl === question.media.url ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Image unavailable
                {question.media.alt ? ` — ${question.media.alt}` : ""}
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={question.media.url}
                alt={question.media.alt || "Question media"}
                className="h-full w-full object-cover"
                onError={() => setFailedMediaUrl(question.media?.url || "")}
              />
            )}
          </div>
        )}

        <div className="space-y-2">
          {options.map((o) => {
            const isSelected = chosen.includes(o.id);
            const isCorrect = correctIds.includes(o.id);
            const showReview = review && correctIds.length > 0;

            return (
              <button
                key={o.id}
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => toggle(o.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors",
                  !disabled && "cursor-pointer hover:bg-accent/50",
                  disabled && "cursor-default",
                  isSelected && !showReview && "border-primary/50 bg-primary/5",
                  showReview && isCorrect && "border-emerald-500/50 bg-emerald-500/10",
                  showReview && isSelected && !isCorrect && "border-destructive/50 bg-destructive/10"
                )}
              >
                {multi ? (
                  <Checkbox
                    checked={isSelected}
                    disabled={disabled}
                    tabIndex={-1}
                    className="pointer-events-none"
                  />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      isSelected ? "border-primary" : "border-muted-foreground/50"
                    )}
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                )}
                <span className="font-normal leading-snug">{o.text}</span>
              </button>
            );
          })}
        </div>

        {review && question.explanation && (
          <p className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Explanation: </span>
            {question.explanation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Lightweight preview for question bank tables (no interactivity). */
export function QuestionTypeBadge({ type }: { type: QuestionType }) {
  return <Badge variant="secondary">{TYPE_LABEL[type]}</Badge>;
}
