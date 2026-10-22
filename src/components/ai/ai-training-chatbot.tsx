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

const POSITION_KEY = "pharma-ask-ai-pos";
const EDGE = 12;

function clampPoint(x: number, y: number, width: number, height: number) {
  const maxX = Math.max(EDGE, window.innerWidth - width - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - height - EDGE);
  return {
    x: Math.min(maxX, Math.max(EDGE, x)),
    y: Math.min(maxY, Math.max(EDGE, y)),
  };
}

function readSavedPosition() {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

export function AiTrainingChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: WELCOME },
  ]);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    const place = () => {
      const button = buttonRef.current;
      const width = button?.offsetWidth || 132;
      const height = button?.offsetHeight || 48;
      const saved = readSavedPosition();
      const next = saved
        ? clampPoint(saved.x, saved.y, width, height)
        : clampPoint(window.innerWidth - width - 24, window.innerHeight - height - 24, width, height);
      setPos(next);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  function panelStyle(anchor: { x: number; y: number }) {
    const button = buttonRef.current;
    const buttonW = button?.offsetWidth || 132;
    const buttonH = button?.offsetHeight || 48;
    const panelW = Math.min(380, window.innerWidth - EDGE * 2);
    const panelH = Math.min(520, Math.round(window.innerHeight * 0.7));
    const gap = 12;
    let top = anchor.y - panelH - gap;
    if (top < EDGE) top = anchor.y + buttonH + gap;
    if (top + panelH > window.innerHeight - EDGE) {
      top = Math.max(EDGE, window.innerHeight - panelH - EDGE);
    }
    let left = anchor.x + buttonW - panelW;
    if (left < EDGE) left = anchor.x;
    left = Math.min(Math.max(EDGE, left), Math.max(EDGE, window.innerWidth - panelW - EDGE));
    return { top, left, width: panelW, height: panelH };
  }

  function onDragStart(event: React.PointerEvent<HTMLButtonElement>) {
    if (!pos) return;
    event.preventDefault();
    const drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
    dragRef.current = drag;

    const point = (clientX: number, clientY: number) => {
      const button = buttonRef.current;
      return clampPoint(
        drag.originX + (clientX - drag.startX),
        drag.originY + (clientY - drag.startY),
        button?.offsetWidth || 132,
        button?.offsetHeight || 48
      );
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) <= 4) return;
      drag.moved = true;
      setDragging(true);
      setPos(point(e.clientX, e.clientY));
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      dragRef.current = null;
      setDragging(false);
      if (drag.moved) {
        const next = point(e.clientX, e.clientY);
        setPos(next);
        localStorage.setItem(POSITION_KEY, JSON.stringify(next));
        return;
      }
      setOpen((value) => !value);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

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

  const panel = open && pos ? panelStyle(pos) : null;

  return (
    <>
      {panel && (
        <div
          className="pointer-events-auto fixed z-50 flex flex-col overflow-hidden rounded-xl border bg-background shadow-xl"
          style={{ top: panel.top, left: panel.left, width: panel.width, height: panel.height }}
        >
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
              aria-label="Close assistant"
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
                aria-label="Send message"
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
        ref={buttonRef}
        type="button"
        size="lg"
        className="pointer-events-auto fixed z-50 h-12 cursor-grab touch-none select-none gap-2 rounded-full px-4 shadow-lg active:scale-100 active:cursor-grabbing"
        style={{
          position: "fixed",
          ...(pos ? { left: pos.x, top: pos.y } : { right: 24, bottom: 24 }),
          transition: dragging ? "none" : undefined,
        }}
        onPointerDown={onDragStart}
        aria-label={open ? "Close training assistant" : "Ask AI. Drag to move."}
      >
        <MessageCircle className="h-5 w-5" />
        {open ? "Close" : "Ask AI"}
      </Button>
    </>
  );
}
