"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExamTimerProps {
  expiresAt: string;
  onExpire: () => void;
  /** Show last autosave timestamp */
  lastSavedAt?: string | null;
  saving?: boolean;
}

export function ExamTimer({ expiresAt, onExpire, lastSavedAt, saving }: ExamTimerProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const tick = () => {
      const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(ms);
      if (ms === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const urgent = totalSeconds < 120;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-mono font-semibold",
          urgent
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-border bg-card text-foreground"
        )}
      >
        <Clock className="h-4 w-4" />
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      {(saving || lastSavedAt) && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Save className="h-3.5 w-3.5" />
          {saving
            ? "Saving…"
            : lastSavedAt
              ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
              : null}
        </span>
      )}
    </div>
  );
}
