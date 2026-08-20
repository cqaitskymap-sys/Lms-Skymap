"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createQuestion } from "@/lib/services/assessments";
import { Can } from "@/components/auth/require-permission";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportPaperPanel } from "@/components/exams/import-paper-panel";
import {
  QuestionFormFields,
  buildQuestionPayload,
  emptyQuestionValues,
  type QuestionFormValues,
} from "@/components/exams/question-form-fields";
import type { QuestionBank } from "@/types";

interface Props {
  banks: QuestionBank[];
  defaultBankId?: string;
  onCreated: () => void;
}

export function CreateQuestionDialog({ banks, defaultBankId, onCreated }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "pdf">("manual");
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<QuestionFormValues>(() =>
    emptyQuestionValues(defaultBankId || "")
  );

  useEffect(() => {
    if (defaultBankId) {
      setValues((prev) => ({ ...prev, bankId: prev.bankId || defaultBankId }));
    }
  }, [defaultBankId]);

  const resetForm = () => {
    setValues(emptyQuestionValues(defaultBankId || ""));
    setMode("manual");
  };

  const handleCreate = async () => {
    if (!profile) return;
    let payload;
    try {
      payload = buildQuestionPayload(values);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid question");
      return;
    }

    setBusy(true);
    try {
      await createQuestion(
        {
          ...payload,
          isActive: true,
        },
        profile.uid
      );
      toast.success("Question added");
      setOpen(false);
      resetForm();
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add question");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Can permission="questions:write">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5" disabled={!banks.length}>
            <Plus className="h-3.5 w-3.5" /> Add question
          </Button>
        </DialogTrigger>
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto",
            mode === "pdf" ? "sm:max-w-2xl" : "sm:max-w-lg"
          )}
        >
          <DialogHeader>
            <DialogTitle>Add question</DialogTitle>
            <DialogDescription>
              {mode === "pdf"
                ? "Upload a question paper PDF and review the extracted questions"
                : "Manual MCQ / True-False / Multi-select entry"}
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "manual" | "pdf")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual entry</TabsTrigger>
              <TabsTrigger value="pdf">From PDF paper</TabsTrigger>
            </TabsList>
            <TabsContent value="pdf" className="mt-4">
              <ImportPaperPanel
                banks={banks}
                defaultBankId={values.bankId || defaultBankId}
                onImported={() => {
                  setOpen(false);
                  resetForm();
                  onCreated();
                }}
              />
            </TabsContent>
            <TabsContent value="manual" className="mt-4">
              <QuestionFormFields
                banks={banks}
                values={values}
                onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
              />
              <DialogFooter>
                <Button disabled={busy} onClick={() => void handleCreate()}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save question
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </Can>
  );
}
