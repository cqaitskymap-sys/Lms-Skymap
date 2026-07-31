"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createQuestion } from "@/lib/services/assessments";
import { generateId } from "@/lib/services/helpers";
import { Can } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type {
  QuestionBank,
  QuestionDifficulty,
  QuestionOption,
  QuestionType,
} from "@/types";

interface Props {
  banks: QuestionBank[];
  defaultBankId?: string;
  onCreated: () => void;
}

type OptionRow = { id: string; text: string; isCorrect: boolean };

function defaultOptions(type: QuestionType): OptionRow[] {
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

export function CreateQuestionDialog({ banks, defaultBankId, onCreated }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bankId, setBankId] = useState(defaultBankId || "");
  const [text, setText] = useState("");
  const [type, setType] = useState<QuestionType>("mcq");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("medium");
  const [marks, setMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [tags, setTags] = useState("");
  const [explanation, setExplanation] = useState("");
  const [scenario, setScenario] = useState("");
  const [options, setOptions] = useState<OptionRow[]>(() => defaultOptions("mcq"));

  useEffect(() => {
    if (defaultBankId) setBankId(defaultBankId);
  }, [defaultBankId]);

  useEffect(() => {
    setOptions(defaultOptions(type));
  }, [type]);

  const setCorrect = (id: string) => {
    if (type === "multi_select") {
      setOptions((prev) =>
        prev.map((o) => (o.id === id ? { ...o, isCorrect: !o.isCorrect } : o))
      );
    } else {
      setOptions((prev) => prev.map((o) => ({ ...o, isCorrect: o.id === id })));
    }
  };

  const handleCreate = async () => {
    if (!profile) return;
    if (!bankId) {
      toast.error("Select or create a question bank first");
      return;
    }
    if (!text.trim()) {
      toast.error("Question text required");
      return;
    }
    const filled = options.filter((o) => o.text.trim());
    if (filled.length < 2) {
      toast.error("Add at least 2 options");
      return;
    }
    if (!filled.some((o) => o.isCorrect)) {
      toast.error("Mark at least one correct option");
      return;
    }

    setBusy(true);
    try {
      const opts: QuestionOption[] = filled.map((o) => ({
        id: o.id,
        text: o.text.trim(),
        isCorrect: o.isCorrect,
      }));

      await createQuestion(
        {
          bankId,
          text: text.trim(),
          type,
          options: opts,
          explanation: explanation.trim() || undefined,
          difficulty,
          marks,
          negativeMarks: negativeMarks || undefined,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          scenario: scenario.trim()
            ? { narrative: scenario.trim() }
            : undefined,
          isActive: true,
        },
        profile.uid
      );
      toast.success("Question added");
      setOpen(false);
      setText("");
      setExplanation("");
      setScenario("");
      setTags("");
      setOptions(defaultOptions(type));
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add question");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Can permission="questions:write">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5" disabled={!banks.length}>
            <Plus className="h-3.5 w-3.5" /> Add question
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add question</DialogTitle>
            <DialogDescription>
              Manual MCQ / True-False / Multi-select entry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Bank</Label>
              <Select value={bankId} onValueChange={setBankId}>
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
                <Select value={type} onValueChange={(v) => setType(v as QuestionType)}>
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
                  value={difficulty}
                  onValueChange={(v) => setDifficulty(v as QuestionDifficulty)}
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

            {(type === "scenario" || scenario) && (
              <div className="space-y-2">
                <Label>Scenario narrative</Label>
                <Textarea
                  rows={2}
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  placeholder="Context shown before the question"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter the question text"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                {type !== "true_false" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setOptions((prev) => [
                        ...prev,
                        { id: generateId("opt"), text: "", isCorrect: false },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Option
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {options.map((o, idx) => (
                  <div key={o.id} className="flex items-start gap-2">
                    <Checkbox
                      className="mt-2.5"
                      checked={o.isCorrect}
                      onCheckedChange={() => setCorrect(o.id)}
                    />
                    <Input
                      value={o.text}
                      disabled={type === "true_false"}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.map((x) =>
                            x.id === o.id ? { ...x, text: e.target.value } : x
                          )
                        )
                      }
                      placeholder={`Option ${idx + 1}`}
                    />
                    {type !== "true_false" && options.length > 2 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setOptions((prev) => prev.filter((x) => x.id !== o.id))
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
                {type === "multi_select" ? "(s)" : ""}.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Marks</Label>
                <Input
                  type="number"
                  min={1}
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Negative marks</Label>
                <Input
                  type="number"
                  min={0}
                  value={negativeMarks}
                  onChange={(e) => setNegativeMarks(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="GMP, hygiene"
              />
            </div>

            <div className="space-y-2">
              <Label>Explanation (optional)</Label>
              <Textarea
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={busy} onClick={() => void handleCreate()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Can>
  );
}
