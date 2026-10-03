"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { listUsersByRoles } from "@/lib/services/users";
import { ROLE_LABELS } from "@/lib/rbac/permissions";
import type { UserProfile } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SopApproverChoice {
  uid: string;
  name: string;
}

export function SopSendForApprovalDialog({
  open,
  onOpenChange,
  sopCount,
  busy,
  progressLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sopCount: number;
  busy?: boolean;
  progressLabel?: string | null;
  onConfirm: (approver: SopApproverChoice) => void;
}) {
  const { profile } = useAuth();
  const [approvers, setApprovers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [approverId, setApproverId] = useState("");

  useEffect(() => {
    if (!open) return;
    setApproverId("");
    let cancelled = false;
    setLoading(true);
    void listUsersByRoles(["qa", "super_admin"])
      .then((users) => {
        if (cancelled) return;
        const list = [...users];
        if (
          profile &&
          (profile.role === "qa" || profile.role === "super_admin") &&
          !list.some((user) => user.uid === profile.uid)
        ) {
          list.unshift(profile);
        }
        setApprovers(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setApprovers([]);
          toast.error(err instanceof Error ? err.message : "Could not load approvers");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, profile]);

  const selected = approvers.find((user) => user.uid === approverId);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Send {sopCount} SOP{sopCount === 1 ? "" : "s"} for approval
          </DialogTitle>
          <DialogDescription>
            Pick who should approve {sopCount === 1 ? "this SOP" : "these SOPs"}. They will see
            them on SOP Management and can approve the whole batch in one step.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="sop-approver">Approver</Label>
          <Select value={approverId || undefined} onValueChange={setApproverId} disabled={busy || loading}>
            <SelectTrigger id="sop-approver">
              <SelectValue placeholder={loading ? "Loading people…" : "Choose QA or Admin"} />
            </SelectTrigger>
            <SelectContent>
              {approvers.map((user) => (
                <SelectItem key={user.uid} value={user.uid}>
                  {user.displayName} · {ROLE_LABELS[user.role] || user.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loading && approvers.length === 0 && (
            <p className="text-sm text-destructive">No QA or Admin users are available.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !selected}
            onClick={() =>
              selected &&
              onConfirm({ uid: selected.uid, name: selected.displayName || "Approver" })
            }
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {progressLabel || "Send for approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SopBulkApproveDialog({
  open,
  onOpenChange,
  sopNumbers,
  busy,
  progressLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sopNumbers: string[];
  busy?: boolean;
  progressLabel?: string | null;
  onConfirm: () => void;
}) {
  const preview = sopNumbers.slice(0, 8);
  const rest = sopNumbers.length - preview.length;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Approve {sopNumbers.length} SOP{sopNumbers.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            This marks every selected SOP as approved in one step. Open a SOP first if you still
            want to read it.
          </DialogDescription>
        </DialogHeader>
        {preview.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-auto text-sm text-muted-foreground">
            {preview.map((number) => (
              <li key={number}>{number}</li>
            ))}
            {rest > 0 && <li>+ {rest} more</li>}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || sopNumbers.length === 0} onClick={onConfirm}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {progressLabel || "Approve all"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
