"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import type { LifecycleApproval } from "@/types";
import { reviewApproval, type LifecycleActor } from "@/lib/services/lifecycle";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

interface LifecycleApprovalsProps {
  approvals: LifecycleApproval[];
  actor: LifecycleActor;
  onUpdated?: () => void;
  /** When false, pending items are read-only (no approve/reject). Default: employees:write */
  canReview?: boolean;
}

export function LifecycleApprovals({
  approvals,
  actor,
  onUpdated,
  canReview: canReviewProp,
}: LifecycleApprovalsProps) {
  const { can } = useAuth();
  const canReview = canReviewProp ?? can("employees:write");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const pending = approvals.filter((a) => a.status === "pending");
  const history = approvals.filter((a) => a.status !== "pending");

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    try {
      await reviewApproval({
        approvalId: id,
        decision,
        comments: comments[id],
        actor,
      });
      toast.success(decision === "approved" ? "Approved" : "Rejected");
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {pending.length === 0 && (
        <p className="text-sm text-muted-foreground">No pending approvals.</p>
      )}
      {pending.map((a) => (
        <div key={a.id} className="space-y-3 rounded-md border p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="text-sm text-muted-foreground">{a.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Requested by {a.requestedByName || a.requestedBy} ·{" "}
                {formatDateTime(a.requestedAt)}
              </p>
            </div>
            <Badge variant="secondary">Pending</Badge>
          </div>
          <Textarea
            placeholder="Comments (optional)"
            value={comments[a.id] || ""}
            onChange={(e) => setComments((c) => ({ ...c, [a.id]: e.target.value }))}
            rows={2}
            disabled={!canReview}
          />
          {canReview ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busyId === a.id}
                onClick={() => decide(a.id, "approved")}
              >
                {busyId === a.id ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1 h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === a.id}
                onClick={() => decide(a.id, "rejected")}
              >
                <X className="mr-1 h-4 w-4" />
                Reject
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only HR can approve or reject this request.
            </p>
          )}
        </div>
      ))}

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            History
          </p>
          {history.slice(0, 5).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>{a.title}</span>
              <Badge variant={a.status === "approved" ? "default" : "destructive"}>
                {a.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
