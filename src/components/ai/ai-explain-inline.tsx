"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { explainWithAi, type ExplainKind } from "@/lib/services/ai";
import { Button } from "@/components/ui/button";

interface Props {
  kind: ExplainKind;
  title: string;
  description?: string;
  content?: string;
  changeSummary?: string;
  buttonLabel?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "secondary" | "outline" | "ghost";
}

export function AiExplainInline({
  kind,
  title,
  description,
  content,
  changeSummary,
  buttonLabel = "Explain with AI",
  size = "sm",
  variant = "outline",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    try {
      const { explanation } = await explainWithAi({
        kind,
        title,
        description,
        content,
        changeSummary,
        audience: "employee",
      });
      setText(explanation);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Explain failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size={size}
        variant={variant}
        className="gap-1.5"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {busy ? "Explaining…" : text ? "Regenerate" : buttonLabel}
      </Button>
      {text && (
        <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}
