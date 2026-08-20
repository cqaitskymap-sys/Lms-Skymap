"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { updateQuestion } from "@/lib/services/assessments";
import { Can } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  QuestionFormFields,
  buildQuestionPayload,
  emptyQuestionValues,
  valuesFromQuestion,
  type QuestionFormValues,
} from "@/components/exams/question-form-fields";
import type { Question, QuestionBank } from "@/types";

interface Props {
  question: Question | null;
  banks: QuestionBank[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditQuestionDialog({
  question,
  banks,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<QuestionFormValues>(emptyQuestionValues());

  useEffect(() => {
    if (open && question) setValues(valuesFromQuestion(question));
  }, [open, question]);

  const handleSave = async () => {
    if (!profile || !question) return;
    let payload;
    try {
      payload = buildQuestionPayload(values);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid question");
      return;
    }

    setBusy(true);
    try {
      await updateQuestion(
        question.id,
        {
          bankId: payload.bankId,
          text: payload.text,
          type: payload.type,
          options: payload.options,
          explanation: payload.explanation,
          difficulty: payload.difficulty,
          marks: payload.marks,
          negativeMarks: payload.negativeMarks ?? 0,
          tags: payload.tags,
          scenario: payload.scenario,
        },
        profile.uid
      );
      toast.success("Question updated");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update question");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
          <DialogDescription>Update the question, options, and correct answer</DialogDescription>
        </DialogHeader>
        <QuestionFormFields
          banks={banks}
          values={values}
          onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void handleSave()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditQuestionButton({ onClick }: { onClick: () => void }) {
  return (
    <Can permission="questions:write">
      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1 text-xs"
        onClick={onClick}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
    </Can>
  );
}
