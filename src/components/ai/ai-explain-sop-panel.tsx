"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { explainSopWithAi } from "@/lib/services/ai";
import { Can } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  title: string;
  description?: string;
  changeSummary?: string;
}

export function AiExplainSopPanel({ title, description, changeSummary }: Props) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);

  async function handleExplain() {
    setBusy(true);
    try {
      const { explanation, model } = await explainSopWithAi({
        kind: "sop",
        title,
        description,
        changeSummary,
        audience: "employee",
      });
      setText(explanation);
      toast.success(`Explanation ready (${model})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Explain failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Can permission="sops:read">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-cyan-700" />
            AI explain
          </CardTitle>
          <CardDescription>
            Plain-language summary for training — always verify against the official SOP PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={busy}
            onClick={() => void handleExplain()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {busy ? "Explaining…" : text ? "Regenerate" : "Explain this SOP"}
          </Button>
          {text && (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm dark:prose-invert">
              {text}
            </div>
          )}
        </CardContent>
      </Card>
    </Can>
  );
}
