"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  approveJdHandoverAssignment,
  fetchMyJdSignoffs,
  type JdPendingSignoffRow,
} from "@/lib/services/jd-handover";
import {
  approveTniSignoffAssignment,
  fetchMyTniSignoffs,
  type TniPendingSignoffRow,
} from "@/lib/services/tni-signoff";
import { TRAINING_UPDATED_EVENT, notifyTrainingUpdated } from "@/lib/training/demo-store";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/lib/services/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

type PendingRow =
  | { kind: "jd"; key: string; row: JdPendingSignoffRow }
  | { kind: "tni"; key: string; row: TniPendingSignoffRow };

export function JdHandoverPendingCard() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!profile?.uid) {
      setPending([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    const actor = { uid: profile.uid, employeeId: profile.employeeId };
    try {
      const [jdRes, tniRes] = await Promise.allSettled([
        fetchMyJdSignoffs(actor),
        fetchMyTniSignoffs(actor),
      ]);
      const jdPending = jdRes.status === "fulfilled" ? jdRes.value.pending : [];
      const tniPending = tniRes.status === "fulfilled" ? tniRes.value.pending : [];
      const rows: PendingRow[] = [
        ...jdPending.map((row) => ({
          kind: "jd" as const,
          key: `jd:${row.jdId}:${row.slot}`,
          row,
        })),
        ...tniPending.map((row) => ({
          kind: "tni" as const,
          key: `tni:${row.tniId}:${row.slot}`,
          row,
        })),
      ];
      setPending(rows);
      const failed = [jdRes, tniRes].filter((res) => res.status === "rejected");
      if (failed.length) {
        const err = failed[0].status === "rejected" ? failed[0].reason : null;
        setError(
          err instanceof Error ? err.message : "Could not load signatures waiting for you"
        );
      } else {
        setError(null);
      }
    } catch (err) {
      setPending([]);
      setError(
        err instanceof Error ? err.message : "Could not load signatures waiting for you"
      );
    } finally {
      setLoading(false);
    }
  }, [profile?.uid, profile?.employeeId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh(true);
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    };
  }, [refresh]);

  async function handleApprove(item: PendingRow) {
    if (!profile) return;
    setBusyKey(item.key);
    try {
      const actor = {
        uid: profile.uid,
        name: profile.displayName,
        employeeId: profile.employeeId,
      };
      if (item.kind === "jd") {
        await approveJdHandoverAssignment(item.row.jdId, actor, item.row.slot);
      } else {
        await approveTniSignoffAssignment(item.row.tniId, actor, item.row.slot);
      }
      toast.success(
        `${item.row.actionLabel === "Accept" ? "Accepted" : "Approved"} — electronically computer-generated signature added`
      );
      setPending((prev) => prev.filter((row) => row.key !== item.key));
      notifyTrainingUpdated();
      window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusyKey(null);
    }
  }

  if (!profile || (!loading && pending.length === 0 && !error)) return null;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle>Signatures waiting for you</CardTitle>
        <CardDescription>
          Approve to add your electronically computer-generated signature on the JD or TNI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading assigned signatures…
          </div>
        ) : (
          <>
            {error && (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{error}</p>
                <Button size="sm" variant="outline" onClick={() => void refresh()}>
                  Retry
                </Button>
              </div>
            )}
            {pending.map((item) => {
            const { row, key } = item;
            const title =
              item.kind === "jd" ? item.row.title : item.row.label;
            const subtitle =
              item.kind === "jd"
                ? `${item.row.jdNo} · ${item.row.label} · effective ${formatDate(item.row.effectiveFrom)}`
                : `TNI ${item.row.tniId}`;
            return (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <Button
                  size="sm"
                  disabled={busyKey === key}
                  onClick={() => void handleApprove(item)}
                >
                  {busyKey === key ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  )}
                  {row.actionLabel}
                </Button>
              </div>
            );
          })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
