"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { toOjtActor } from "@/lib/ojt/actor";
import { CALENDAR_MONTHS } from "@/lib/ojt/constants";
import { updateOjtAssignmentAdmin, updateOjtTopic } from "@/lib/services/ojt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OjtAssignment, OjtTopic } from "@/types/ojt";
import type { SopDocument } from "@/types";

export function OjtTopicEditDialog({
  topic,
  departments,
  sops,
  open,
  onOpenChange,
  onSaved,
}: {
  topic: OjtTopic | null;
  departments: { id: string; name: string; code?: string }[];
  sops: SopDocument[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [sopId, setSopId] = useState("");
  const [reference, setReference] = useState("");
  const [fallbackTitle, setFallbackTitle] = useState("");

  const sopOptions = [...sops].sort(
    (a, b) => a.title.localeCompare(b.title) || a.sopNumber.localeCompare(b.sopNumber)
  );
  const selectedSop = sopOptions.find((s) => s.id === sopId);

  useEffect(() => {
    if (!topic || !open) return;
    const matched =
      sops.find((s) => s.id === topic.sopId) ||
      sops.find((s) => s.title.trim().toLowerCase() === topic.trainingTopic.trim().toLowerCase());
    setDepartmentId(topic.departmentId);
    setSopId(matched?.id || "");
    setReference(topic.referenceDocumentNumber || topic.sopNumber || matched?.sopNumber || "");
    setFallbackTitle(topic.trainingTopic);
  }, [topic, open, sops]);

  const handleSopChange = (id: string) => {
    setSopId(id);
    const sop = sops.find((s) => s.id === id);
    if (sop?.sopNumber) setReference(sop.sopNumber);
  };

  const handleSave = async () => {
    const trainingTopic = selectedSop?.title.trim() || fallbackTitle.trim();
    if (!profile || !topic || !trainingTopic) {
      toast.error("SOP title is required");
      return;
    }
    const department = departments.find((d) => d.id === departmentId);
    setBusy(true);
    try {
      await updateOjtTopic(
        topic.id,
        {
          trainingTopic,
          departmentId: department?.id || topic.departmentId,
          departmentName: department?.name || topic.departmentName,
          ...(selectedSop ? { sopId: selectedSop.id } : {}),
          referenceDocumentNumber: reference.trim() || selectedSop?.sopNumber || topic.referenceDocumentNumber || "NA",
        },
        toOjtActor(profile)
      );
      toast.success("Topic updated");
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit OJT topic</DialogTitle>
          <DialogDescription>Only Super Admin can change topic details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Department</Label>
            <Select value={departmentId || undefined} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.code ? `${d.code} — ${d.name}` : d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>SOP title</Label>
            <Select value={sopId || undefined} onValueChange={handleSopChange}>
              <SelectTrigger>
                <SelectValue placeholder={fallbackTitle || "Select SOP title"} />
              </SelectTrigger>
              <SelectContent>
                {sopOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                    {s.sopNumber ? ` (${s.sopNumber})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>SOP / Reference document no.</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="SOP/QA/067 or NA"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void handleSave()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OjtAssignmentEditDialog({
  assignment,
  trainers,
  open,
  onOpenChange,
  onSaved,
}: {
  assignment: OjtAssignment | null;
  trainers: { uid: string; displayName: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState("1");
  const [trainerId, setTrainerId] = useState("none");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!assignment || !open) return;
    setTitle(assignment.trainingTopic);
    setMonth(String(assignment.plannedExecutionMonth));
    setTrainerId(assignment.trainerId || "none");
    setRemarks(assignment.remarks || "");
  }, [assignment, open]);

  const handleSave = async () => {
    if (!profile || !assignment || !title.trim()) {
      toast.error("Training topic is required");
      return;
    }
    const trainer = trainers.find((t) => t.uid === trainerId);
    setBusy(true);
    try {
      await updateOjtAssignmentAdmin(
        assignment.id,
        {
          trainingTopic: title.trim(),
          plannedExecutionMonth: Number(month),
          trainerId: trainerId === "none" ? undefined : trainerId,
          trainerName: trainerId === "none" ? undefined : trainer?.displayName,
          remarks: remarks.trim() || undefined,
        },
        toOjtActor(profile)
      );
      toast.success("OJT record updated");
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit OJT record</DialogTitle>
          <DialogDescription>
            {assignment
              ? `${assignment.employeeName} · ${assignment.employeeCode}`
              : "Only Super Admin can edit OJT records."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Training topic</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Planned execution month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CALENDAR_MONTHS.map((m) => (
                  <SelectItem key={m.number} value={String(m.number)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Trainer</Label>
            <Select value={trainerId} onValueChange={setTrainerId}>
              <SelectTrigger>
                <SelectValue placeholder="Trainer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {trainers.map((t) => (
                  <SelectItem key={t.uid} value={t.uid}>
                    {t.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void handleSave()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
