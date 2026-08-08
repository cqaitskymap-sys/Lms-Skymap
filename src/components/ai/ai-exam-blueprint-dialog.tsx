"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Can } from "@/components/auth/require-permission";
import {
  generateExamBlueprintWithAi,
  generateQuestionsWithAi,
  type ExamBlueprint,
} from "@/lib/services/ai";
import { createExam, createQuestion } from "@/lib/services/assessments";
import type { QuestionBank } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  banks: QuestionBank[];
  onSaved: () => Promise<void> | void;
}

export function AiExamBlueprintDialog({ banks, onSaved }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [audience, setAudience] = useState<"induction" | "sop_retrain" | "general">(
    "general"
  );
  const [bankId, setBankId] = useState("");
  const [alsoGenerateQuestions, setAlsoGenerateQuestions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blueprint, setBlueprint] = useState<ExamBlueprint | null>(null);

  const activeBanks = useMemo(() => banks.filter((b) => b.isActive), [banks]);

  async function handleGenerate() {
    if (!topic.trim()) {
      toast.error("Enter a topic");
      return;
    }
    setBusy(true);
    setBlueprint(null);
    try {
      const { blueprint: bp, model } = await generateExamBlueprintWithAi({
        topic: topic.trim(),
        context: context.trim() || undefined,
        audience,
      });
      setBlueprint(bp);
      if (!bankId && activeBanks[0]) setBankId(activeBanks[0].id);
      toast.success(`Blueprint ready (${model})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Blueprint failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!profile || !blueprint) return;
    if (!bankId) {
      toast.error("Select a question bank");
      return;
    }
    setSaving(true);
    try {
      if (alsoGenerateQuestions) {
        const { questions } = await generateQuestionsWithAi({
          topic: topic.trim() || blueprint.title,
          context: context.trim() || blueprint.description,
          count: Math.min(
            10,
            Math.max(1, Math.round(Number(blueprint.questionCount)) || 5)
          ),
          difficulty: "mixed",
          types: ["mcq", "true_false", "scenario"],
        });
        for (const q of questions) {
          await createQuestion(
            {
              bankId,
              text: q.text,
              type: q.type,
              options: q.options,
              explanation: q.explanation,
              difficulty: q.difficulty,
              marks: q.marks,
              negativeMarks: blueprint.negativeMarkingEnabled ? 0.25 : 0,
              tags: [...(q.tags || []), "ai-generated", ...blueprint.suggestedTags],
              scenario: q.scenario,
              isActive: true,
            },
            profile.uid
          );
        }
      }

      await createExam(
        {
          title: blueprint.title,
          description: blueprint.description,
          bankId,
          questionCount: blueprint.questionCount,
          durationMinutes: blueprint.durationMinutes,
          passPercentage: blueprint.passPercentage,
          shuffleQuestions: blueprint.shuffleQuestions,
          shuffleOptions: blueprint.shuffleOptions,
          randomizeFromBank: blueprint.randomizeFromBank,
          difficultyMix: blueprint.difficultyMix,
          negativeMarkingEnabled: blueprint.negativeMarkingEnabled,
          maxAttempts: blueprint.maxAttempts,
          showResultsImmediately: true,
          autoSaveEnabled: true,
          autoSaveIntervalSeconds: 20,
          autoSubmitOnTimeout: true,
          allowReview: true,
          certificatePassPercentage: blueprint.passPercentage,
          leaderboardEnabled: true,
          isActive: true,
        },
        profile.uid
      );

      toast.success("Exam created from AI blueprint");
      setOpen(false);
      setBlueprint(null);
      setTopic("");
      setContext("");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create exam");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Can permission="exams:write">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="secondary" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Exam blueprint (AI)
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI exam blueprint</DialogTitle>
            <DialogDescription>
              Generate duration, pass %, difficulty mix, then create the exam (optionally seed
              questions into a bank).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input
                placeholder="e.g. Data integrity ALCOA+ refresher"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>SOP / training context (optional)</Label>
              <Textarea
                rows={3}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Paste SOP summary or induction module notes…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select
                  value={audience}
                  onValueChange={(v) =>
                    setAudience(v as "induction" | "sop_retrain" | "general")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="induction">Induction</SelectItem>
                    <SelectItem value="sop_retrain">SOP retrain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Question bank</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeBanks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={alsoGenerateQuestions}
                onCheckedChange={(v) => setAlsoGenerateQuestions(Boolean(v))}
              />
              Also generate sample questions into the bank
            </label>

            <Button type="button" disabled={busy} className="gap-2" onClick={() => void handleGenerate()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? "Designing…" : "Generate blueprint"}
            </Button>

            {blueprint && (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="font-semibold">{blueprint.title}</p>
                <p className="text-muted-foreground">{blueprint.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary">{blueprint.questionCount} questions</Badge>
                  <Badge variant="secondary">{blueprint.durationMinutes} min</Badge>
                  <Badge variant="secondary">Pass {blueprint.passPercentage}%</Badge>
                  <Badge variant="outline">
                    Mix E{blueprint.difficultyMix.easy}/M{blueprint.difficultyMix.medium}/H
                    {blueprint.difficultyMix.hard}
                  </Badge>
                  {blueprint.negativeMarkingEnabled && (
                    <Badge variant="outline">Negative marking</Badge>
                  )}
                </div>
                {blueprint.notesForTrainer && (
                  <p className="text-xs text-muted-foreground">
                    Trainer note: {blueprint.notesForTrainer}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!blueprint || saving}
              onClick={() => void handleCreate()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create exam"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Can>
  );
}
