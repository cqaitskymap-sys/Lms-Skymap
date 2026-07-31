"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderPlus, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createQuestionBank } from "@/lib/services/assessments";
import { Can } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  onCreated: (bankId: string) => void;
}

export function CreateQuestionBankDialog({ onCreated }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!profile) return;
    if (!name.trim()) {
      toast.error("Bank name required");
      return;
    }
    setBusy(true);
    try {
      const bank = await createQuestionBank(
        {
          name: name.trim(),
          description: description.trim() || undefined,
        },
        profile.uid
      );
      toast.success(`Bank “${bank.name}” created`);
      setOpen(false);
      setName("");
      setDescription("");
      onCreated(bank.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create bank");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Can permission="questions:write">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" /> Create bank
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create question bank</DialogTitle>
            <DialogDescription>
              Group questions by topic (e.g. GMP, Document Control, Induction)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. GMP Basics"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this bank covers"
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={busy} onClick={() => void handleCreate()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create bank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Can>
  );
}
