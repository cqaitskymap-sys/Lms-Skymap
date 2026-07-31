"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, PenLine } from "lucide-react";
import type { SopAcknowledgement, SopVersion } from "@/types";
import type { SopActor } from "@/lib/services/sops";
import { acknowledgeSop } from "@/lib/services/sops";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils";

interface SopAcknowledgementPanelProps {
  sopId: string;
  version: SopVersion;
  actor: SopActor;
  acknowledgements: SopAcknowledgement[];
  onDone?: () => void;
  canAcknowledge?: boolean;
}

export function SopAcknowledgementPanel({
  sopId,
  version,
  actor,
  acknowledgements,
  onDone,
  canAcknowledge = true,
}: SopAcknowledgementPanelProps) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const mine = acknowledgements.find(
    (a) => a.versionId === version.id && a.userId === actor.uid
  );

  const submit = async () => {
    if (!agreed) {
      toast.error("Confirm that you have read and understood the SOP");
      return;
    }
    setBusy(true);
    try {
      await acknowledgeSop({
        sopId,
        versionId: version.id,
        versionNumber: version.versionNumber,
        actor,
      });
      toast.success("Digital acknowledgement recorded");
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Acknowledgement failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {mine ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium">Acknowledged</p>
              <p className="text-sm text-muted-foreground">
                You acknowledged v{mine.versionNumber} on {formatDateTime(mine.acknowledgedAt)}
              </p>
            </div>
          </div>
        </div>
      ) : canAcknowledge && version.status === "approved" ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Digital acknowledgement</p>
          </div>
          <p className="text-xs text-muted-foreground">
            I have read and understood this Standard Operating Procedure (v
            {version.versionNumber}) and agree to comply with its requirements in my role.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(Boolean(c))} />
            <Label className="font-normal leading-snug">
              I confirm I have reviewed the document and attachments
            </Label>
          </label>
          <Button disabled={busy || !agreed} onClick={() => void submit()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign & acknowledge
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Acknowledgement available after the SOP is approved.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Acknowledgement register ({acknowledgements.length})
        </p>
        {acknowledgements.length === 0 && (
          <p className="text-sm text-muted-foreground">No acknowledgements yet.</p>
        )}
        {acknowledgements.slice(0, 8).map((a) => (
          <div key={a.id} className="rounded-md border px-3 py-2 text-sm">
            <p className="font-medium">{a.userName}</p>
            <p className="text-xs text-muted-foreground">
              v{a.versionNumber} · {formatDateTime(a.acknowledgedAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
