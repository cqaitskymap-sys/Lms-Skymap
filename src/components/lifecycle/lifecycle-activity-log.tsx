"use client";

import { formatDateTime } from "@/lib/utils";
import type { LifecycleEvent } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LifecycleActivityLogProps {
  events: LifecycleEvent[];
  maxHeight?: string;
}

/** Chronological activity feed (newest first) derived from lifecycle events. */
export function LifecycleActivityLog({
  events,
  maxHeight = "320px",
}: LifecycleActivityLogProps) {
  const sorted = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <ScrollArea style={{ maxHeight }}>
      <div className="space-y-3">
        {sorted.map((item) => (
          <div key={item.id} className="rounded-md border px-3 py-2">
            <p className="text-sm font-medium">{item.description}</p>
            <p className="text-xs text-muted-foreground">
              {item.title}
              {item.actorName ? ` · ${item.actorName}` : ""}
              {item.actorRole ? ` (${item.actorRole})` : ""}
              {" · "}
              {formatDateTime(item.completedAt || item.createdAt)}
            </p>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        )}
      </div>
    </ScrollArea>
  );
}
