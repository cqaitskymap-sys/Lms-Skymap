"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Can } from "@/components/auth/require-permission";
import {
  generateQuestionsWithAi,
  type AiGeneratedQuestion,
} from "@/lib/services/ai";
import { createQuestion } from "@/lib/services/assessments";
import type { QuestionBank } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { QuestionTypeBadge } from "@/components/exams/question-renderer";

const TYPE_OPTIONS = [
  { id: "mcq", label: "MCQ" },
  { id: "true_false", label: "True/False" },
  { id: "multi_select", label: "Multi select" },
  { id: "scenario", label: "Scenario" },
] as const;

interface Props {
  banks: QuestionBank[];
  onSaved: () => Promise<void> | void;
}

export function AiGenerateQuestionsDialog({ banks, onSaved }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">(
    "mixed"
  );
  const [types, setTypes] = useState<string[]>(["mcq", "true_false"]);
  const [bankId, setBankId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<AiGeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const activeBanks = useMemo(() => banks.filter((b) => b.isActive), [banks]);

  function toggleType(id: string) {
    setTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleGenerate() {
    if (!topic.trim()) {
      toast.error("Enter a topic");
      return;
    }
    if (types.length === 0) {
      toast.error("Select at least one question type");
      return;
    }
    setBusy(true);
    setDrafts([]);
    try {
      const { questions, model } = await generateQuestionsWithAi({
        topic: topic.trim(),
        context: context.trim() || undefined,
        count: Math.min(10, Math.max(1, Number(count) || 5)),
        difficulty,
        types: types as Array<"mcq" | "true_false" | "multi_select" | "scenario">,
      });
      setDrafts(questions);
      setSelected(Object.fromEntries(questions.map((_, i) => [i, true])));
      if (!bankId && activeBanks[0]) setBankId(activeBanks[0].id);
      toast.success(`Generated ${questions.length} questions (${model})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!profile) {
      toast.error("Sign in required");
      return;
    }
    if (!bankId) {
      toast.error("Select a question bank");
      return;
    }
    const toSave = drafts.filter((_, i) => selected[i]);
    if (toSave.length === 0) {
      toast.error("Select at least one question");
      return;
    }

    setSaving(true);
    try {
      for (const q of toSave) {
        await createQuestion(
          {
            bankId,
            text: q.text,
            type: q.type,
            options: q.options,
            explanation: q.explanation,
            difficulty: q.difficulty,
            marks: q.marks,
            negativeMarks: 0,
            tags: [...(q.tags || []), "ai-generated"],
            scenario: q.scenario,
            isActive: true,
          },
          profile.uid
        );
      }
      toast.success(`Added ${toSave.length} question(s) to bank`);
      setOpen(false);
      setDrafts([]);
      setTopic("");
      setContext("");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save questions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Can permission="questions:write">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate with AI
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate questions with AI</DialogTitle>
            <DialogDescription>
              Create GMP-style assessment items from a topic or SOP summary, then
              review before adding them to a bank.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ai-topic">Topic</Label>
              <Input
                id="ai-topic"
                placeholder="e.g. Line clearance before batch start"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-context">SOP / training context (optional)</Label>
              <Textarea
                id="ai-context"
                rows={4}
                placeholder="Paste SOP description, change summary, or key procedures…"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Count</Label>
                <Select value={count} onValueChange={setCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["3", "5", "8", "10"].map((n) => (
                      <SelectItem key={n} value={n}>
                        {n} questions
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select
                  value={difficulty}
                  onValueChange={(v) =>
                    setDifficulty(v as "easy" | "medium" | "hard" | "mixed")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Types</Label>
              <div className="flex flex-wrap gap-3">
                {TYPE_OPTIONS.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={types.includes(t.id)}
                      onCheckedChange={() => toggleType(t.id)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={busy}
              className="w-full gap-2 sm:w-auto"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {busy ? "Generating…" : "Generate"}
            </Button>

            {drafts.length > 0 && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Preview ({drafts.length})</p>
                  <div className="w-full max-w-xs space-y-1.5 sm:w-56">
                    <Label>Save to bank</Label>
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
                <ul className="space-y-3">
                  {drafts.map((q, i) => (
                    <li key={i} className="rounded-md bg-muted/40 p-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={Boolean(selected[i])}
                          onCheckedChange={(v) =>
                            setSelected((prev) => ({ ...prev, [i]: Boolean(v) }))
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap gap-1.5">
                            <QuestionTypeBadge type={q.type} />
                            <Badge variant="outline" className="capitalize">
                              {q.difficulty}
                            </Badge>
                            <Badge variant="secondary">{q.marks} marks</Badge>
                          </div>
                          <p className="font-medium">{q.text}</p>
                          {q.scenario && (
                            <p className="text-xs text-muted-foreground">
                              Scenario: {q.scenario.narrative}
                            </p>
                          )}
                          <ul className="mt-1 space-y-0.5 text-muted-foreground">
                            {q.options.map((o) => (
                              <li key={o.id}>
                                {o.isCorrect ? "✓" : "·"} {o.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || drafts.length === 0}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Add selected to bank"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Can>
  );
}
