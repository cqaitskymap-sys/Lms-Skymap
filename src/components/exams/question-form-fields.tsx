"use client";

import { Plus, Trash2 } from "lucide-react";
import { generateId } from "@/lib/services/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Question,
  QuestionBank,
  QuestionDifficulty,
  QuestionOption,
  QuestionType,
} from "@/types";

export type OptionRow = { id: string; text: string; isCorrect: boolean };

export function defaultQuestionOptions(type: QuestionType): OptionRow[] {
  if (type === "true_false") {
    return [
      { id: generateId("opt"), text: "True", isCorrect: true },
      { id: generateId("opt"), text: "False", isCorrect: false },
    ];
  }
  return [
    { id: generateId("opt"), text: "", isCorrect: true },
    { id: generateId("opt"), text: "", isCorrect: false },
    { id: generateId("opt"), text: "", isCorrect: false },
    { id: generateId("opt"), text: "", isCorrect: false },
  ];
}

export function optionsFromQuestion(question: Question): OptionRow[] {
  if (question.options?.length) {
    return question.options.map((o) => ({
      id: o.id,
      text: o.text,
      isCorrect: Boolean(o.isCorrect),
    }));
  }
  return defaultQuestionOptions(question.type);
}

export type QuestionFormValues = {
  bankId: string;
  text: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  marks: number;
  negativeMarks: number;
  tags: string;
  explanation: string;
  scenario: string;
  options: OptionRow[];
};

export function valuesFromQuestion(question: Question): QuestionFormValues {
  return {
    bankId: question.bankId,
    text: question.text,
    type: question.type,
    difficulty: question.difficulty,
    marks: question.marks,
    negativeMarks: question.negativeMarks ?? 0,
    tags: (question.tags || []).join(", "),
    explanation: question.explanation || "",
    scenario: question.scenario?.narrative || "",
    options: optionsFromQuestion(question),
  };
}

export function emptyQuestionValues(bankId = ""): QuestionFormValues {
  return {
    bankId,
    text: "",
    type: "mcq",
    difficulty: "medium",
    marks: 1,
    negativeMarks: 0,
    tags: "",
    explanation: "",
    scenario: "",
    options: defaultQuestionOptions("mcq"),
  };
}

export function buildQuestionPayload(values: QuestionFormValues): {
  bankId: string;
  text: string;
  type: QuestionType;
  options: QuestionOption[];
  explanation?: string;
  difficulty: QuestionDifficulty;
  marks: number;
  negativeMarks?: number;
  tags: string[];
  scenario?: { narrative: string };
} {
  if (!values.bankId) throw new Error("Select or create a question bank first");
  if (!values.text.trim()) throw new Error("Question text required");
  const filled = values.options.filter((o) => o.text.trim());
  if (filled.length < 2) throw new Error("Add at least 2 options");
  const correctCount = filled.filter((o) => o.isCorrect).length;
  if (!correctCount) throw new Error("Mark at least one correct option");
  if ((values.type === "mcq" || values.type === "true_false") && correctCount !== 1) {
    throw new Error("MCQ and True/False need exactly one correct option");
  }
  if (values.type === "scenario" && !values.scenario.trim()) {
    throw new Error("Scenario narrative is required");
  }
  if (values.marks < 1) throw new Error("Marks must be at least 1");
  if (values.negativeMarks < 0) throw new Error("Negative marks cannot be below 0");

  return {
    bankId: values.bankId,
    text: values.text.trim(),
    type: values.type,
    options: filled.map((o) => ({
      id: o.id,
      text: o.text.trim(),
      isCorrect: o.isCorrect,
    })),
    explanation: values.explanation.trim() || undefined,
    difficulty: values.difficulty,
    marks: values.marks,
    negativeMarks: values.negativeMarks || undefined,
    tags: values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    scenario: values.scenario.trim() ? { narrative: values.scenario.trim() } : undefined,
  };
}

interface QuestionFormFieldsProps {
  banks: QuestionBank[];
  values: QuestionFormValues;
  onChange: (patch: Partial<QuestionFormValues>) => void;
}

export function QuestionFormFields({ banks, values, onChange }: QuestionFormFieldsProps) {
  const setCorrect = (id: string) => {
    if (values.type === "multi_select") {
      onChange({
        options: values.options.map((o) =>
          o.id === id ? { ...o, isCorrect: !o.isCorrect } : o
        ),
      });
    } else {
      onChange({
        options: values.options.map((o) => ({ ...o, isCorrect: o.id === id })),
      });
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Bank</Label>
        <Select value={values.bankId} onValueChange={(bankId) => onChange({ bankId })}>
          <SelectTrigger>
            <SelectValue placeholder="Select bank" />
          </SelectTrigger>
          <SelectContent>
            {banks.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={values.type}
            onValueChange={(v) => {
              const type = v as QuestionType;
              onChange({ type, options: defaultQuestionOptions(type) });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcq">MCQ</SelectItem>
              <SelectItem value="true_false">True/False</SelectItem>
              <SelectItem value="multi_select">Multi select</SelectItem>
              <SelectItem value="scenario">Scenario</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select
            value={values.difficulty}
            onValueChange={(v) => onChange({ difficulty: v as QuestionDifficulty })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(values.type === "scenario" || values.scenario) && (
        <div className="space-y-2">
          <Label>Scenario narrative</Label>
          <Textarea
            rows={2}
            value={values.scenario}
            onChange={(e) => onChange({ scenario: e.target.value })}
            placeholder="Context shown before the question"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Question</Label>
        <Textarea
          rows={3}
          value={values.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Enter the question text"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Options</Label>
          {values.type !== "true_false" && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange({
                  options: [
                    ...values.options,
                    { id: generateId("opt"), text: "", isCorrect: false },
                  ],
                })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Option
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {values.options.map((o, idx) => (
            <div key={o.id} className="flex items-start gap-2">
              <Checkbox
                className="mt-2.5"
                checked={o.isCorrect}
                onCheckedChange={() => setCorrect(o.id)}
              />
              <Input
                value={o.text}
                disabled={values.type === "true_false"}
                onChange={(e) =>
                  onChange({
                    options: values.options.map((x) =>
                      x.id === o.id ? { ...x, text: e.target.value } : x
                    ),
                  })
                }
                placeholder={`Option ${idx + 1}`}
              />
              {values.type !== "true_false" && values.options.length > 2 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    onChange({
                      options: values.options.filter((x) => x.id !== o.id),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Tick the correct answer
          {values.type === "multi_select" ? "(s)" : ""}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Marks</Label>
          <Input
            type="number"
            min={1}
            value={values.marks}
            onChange={(e) => onChange({ marks: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div className="space-y-2">
          <Label>Negative marks</Label>
          <Input
            type="number"
            min={0}
            value={values.negativeMarks}
            onChange={(e) =>
              onChange({ negativeMarks: Math.max(0, Number(e.target.value) || 0) })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags (comma separated)</Label>
        <Input
          value={values.tags}
          onChange={(e) => onChange({ tags: e.target.value })}
          placeholder="GMP, hygiene"
        />
      </div>

      <div className="space-y-2">
        <Label>Explanation (optional)</Label>
        <Textarea
          rows={2}
          value={values.explanation}
          onChange={(e) => onChange({ explanation: e.target.value })}
        />
      </div>
    </div>
  );
}
