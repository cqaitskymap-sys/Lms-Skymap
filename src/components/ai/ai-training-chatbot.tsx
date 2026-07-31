"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import {
  chatWithTrainingAi,
  type ChatMessage,
} from "@/lib/services/ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const WELCOME =
  "Hi — I’m your PharmaLMS training assistant. Ask about induction, SOPs, assessments, or company policies.";

export function AiTrainingChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: WELCOME },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const history = messages.filter(
      (m, i) => !(i === 0 && m.role === "assistant")
    );
    const nextUser: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, nextUser]);
    setBusy(true);
    try {
      const { reply } = await chatWithTrainingAi({
        message: text,
        history: [...history, nextUser].slice(-10),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chat failed");
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {open && (
        <div className="pointer-events-auto flex h-[min(520px,70vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b bg-cyan-900 px-3 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <div>
                <p className="text-sm font-semibold leading-none">Training assistant</p>
                <p className="mt-0.5 text-[11px] text-cyan-100/90">Induction · SOP · Policies</p>
              </div>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "ml-auto bg-cyan-800 text-white"
                    : "mr-auto bg-muted text-foreground"
                )}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="mr-auto flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t p-2">
            <div className="flex items-end gap-2">
              <Textarea
                rows={2}
                value={input}
                placeholder="Ask a training question…"
                className="min-h-[60px] resize-none"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                className="shrink-0"
                disabled={busy || !input.trim()}
                onClick={() => void send()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button
        type="button"
        size="lg"
        className="pointer-events-auto h-12 gap-2 rounded-full px-4 shadow-lg"
        onClick={() => setOpen((v) => !v)}
      >
        <MessageCircle className="h-5 w-5" />
        {open ? "Close" : "Ask AI"}
      </Button>
    </div>
  );
}
