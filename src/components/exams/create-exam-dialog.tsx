"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createExam, createQuestionBank } from "@/lib/services/assessments";
import { Can } from "@/components/auth/require-permission";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuestionBank } from "@/types";

interface Props {
  banks: QuestionBank[];
  onCreated: () => void;
}

export function CreateExamDialog({ banks, onCreated }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [bankId, setBankId] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [passPercentage, setPassPercentage] = useState(80);

  const handleCreate = async () => {
    if (!profile) return;
    if (!title.trim()) {
      toast.error("Exam title required");
      return;
    }
    setBusy(true);
    try {
      let resolvedBankId = bankId;
      if (!resolvedBankId) {
        if (!newBankName.trim()) {
          toast.error("Select a question bank or create one");
          setBusy(false);
          return;
        }
        const bank = await createQuestionBank(
          { name: newBankName.trim(), description: `Bank for ${title.trim()}` },
          profile.uid
        );
        resolvedBankId = bank.id;
      }

      await createExam(
        {
          title: title.trim(),
          description: "",
          bankId: resolvedBankId,
          questionCount,
          durationMinutes,
          passPercentage,
          shuffleQuestions: true,
          shuffleOptions: true,
          randomizeFromBank: true,
          negativeMarkingEnabled: false,
          maxAttempts: 3,
          showResultsImmediately: true,
          autoSaveEnabled: true,
          autoSaveIntervalSeconds: 30,
          autoSubmitOnTimeout: true,
          allowReview: true,
          certificatePassPercentage: passPercentage,
          leaderboardEnabled: true,
          isActive: true,
        },
        profile.uid
      );
      toast.success("Exam created — add questions via Question Bank / AI");
      setOpen(false);
      setTitle("");
      setBankId("");
      setNewBankName("");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create exam");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Can permission="exams:write">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Create exam
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create assessment</DialogTitle>
            <DialogDescription>
              Manual exam setup without AI. Add questions to the bank afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="GMP basics assessment"
              />
            </div>
            <div className="space-y-2">
              <Label>Question bank</Label>
              <Select
                value={bankId || "__new"}
                onValueChange={(v) => setBankId(v === "__new" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or create bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new">Create new bank…</SelectItem>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!bankId && (
              <div className="space-y-2">
                <Label>New bank name</Label>
                <Input
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="Induction / GMP bank"
                />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Questions</Label>
                <Input
                  type="number"
                  min={1}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Minutes</Label>
                <Input
                  type="number"
                  min={5}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 5)}
                />
              </div>
              <div className="space-y-2">
                <Label>Pass %</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={passPercentage}
                  onChange={(e) => setPassPercentage(Number(e.target.value) || 80)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={busy} onClick={() => void handleCreate()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Can>
  );
}
