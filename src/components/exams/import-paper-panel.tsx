"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  importQuestionsFromPaper,
  type AiGeneratedQuestion,
} from "@/lib/services/ai";
import { extractQuestionPaper } from "@/lib/pdf/extract-paper";
import { createQuestion } from "@/lib/services/assessments";
import type { QuestionBank } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuestionTypeBadge } from "@/components/exams/question-renderer";

interface Props {
  banks: QuestionBank[];
  defaultBankId?: string;
  onImported: () => void;
}

export function ImportPaperPanel({ banks, defaultBankId, onImported }: Props) {
  const { profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<AiGeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [bankId, setBankId] = useState(defaultBankId || "");
  const [scanned, setScanned] = useState(false);

  const activeBanks = useMemo(() => banks.filter((b) => b.isActive !== false), [banks]);

  const pickFile = (next: File | null) => {
    setFile(next);
    setDrafts([]);
    setSelected({});
    setScanned(false);
  };

  const handleExtract = async () => {
    if (!file) {
      toast.error("Choose a question paper PDF first");
      return;
    }
    setBusy(true);
    setDrafts([]);
    try {
      const paper = await extractQuestionPaper(file);
      const { questions, model, scanned: usedScan } = await importQuestionsFromPaper({
        fileName: paper.fileName,
        paperText: paper.text,
        images: paper.images,
        maxQuestions: 20,
      });
      setDrafts(questions);
      setSelected(Object.fromEntries(questions.map((_, i) => [i, true])));
      setScanned(usedScan || paper.scannedFallback);
      if (!bankId && (defaultBankId || activeBanks[0]?.id)) {
        setBankId(defaultBankId || activeBanks[0].id);
      }
      toast.success(`Read ${questions.length} question(s) (${model})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read the PDF");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
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
    let saved = 0;
    let skipped = 0;
    try {
      for (const q of toSave) {
        try {
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
              tags: q.tags?.length ? q.tags : ["imported-from-paper"],
              scenario: q.scenario,
              isActive: true,
            },
            profile.uid
          );
          saved++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (/already exists/i.test(msg)) {
            skipped++;
            continue;
          }
          throw err;
        }
      }
      if (saved === 0 && skipped > 0) {
        toast.message("Those questions are already in this bank");
      } else {
        const extra = skipped ? ` · ${skipped} already in bank skipped` : "";
        toast.success(`Added ${saved} question(s) to the bank${extra}`);
      }
      pickFile(null);
      onImported();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save questions";
      toast.error(saved > 0 ? `Saved ${saved} then failed: ${msg}` : msg);
      if (saved > 0) onImported();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-muted/30 px-4 py-8 text-center transition-colors hover:border-primary/40 hover:bg-muted/50"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) pickFile(dropped);
        }}
      >
        <FileUp className="mb-2 h-8 w-8 text-primary" />
        <p className="text-sm font-medium">Drop a question paper PDF here</p>
        <p className="mt-1 text-xs text-muted-foreground">
          MCQ / True-False papers · max 12 MB · answers are extracted if printed
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] || null)}
        />
      </div>

      {file && (
        <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
          <span className="min-w-0 truncate font-medium">{file.name}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => pickFile(null)}
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Button
        type="button"
        className="w-full gap-2"
        disabled={busy || !file}
        onClick={() => void handleExtract()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? "Reading paper…" : "Read PDF & create questions"}
      </Button>

      {drafts.length > 0 && (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Preview ({drafts.length})</p>
              <p className="text-xs text-muted-foreground">
                Review correct answers before saving
                {scanned ? " · scanned pages were read as images" : ""}.
              </p>
            </div>
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
          <ul className="max-h-72 space-y-3 overflow-y-auto">
            {drafts.map((q, i) => (
              <li key={i} className="rounded-lg bg-muted/40 p-3 text-sm">
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
          <Button
            type="button"
            className="w-full"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add selected to bank
          </Button>
        </div>
      )}
    </div>
  );
}
