"use client";

import { formatDateTime } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AuditLog } from "@/types";

interface ActivityTimelineProps {
  items: Pick<AuditLog, "id" | "timestamp" | "description" | "actorEmail" | "action">[];
  maxHeight?: string;
}

export function ActivityTimeline({ items, maxHeight = "400px" }: ActivityTimelineProps) {
  return (
    <ScrollArea style={{ maxHeight }}>
      <div className="relative space-y-0 pl-6">
        <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
        {items.map((item) => (
          <div key={item.id} className="relative pb-6 last:pb-0">
            <div className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
            <p className="text-sm font-medium">{item.description}</p>
            <p className="text-xs text-muted-foreground">
              {item.actorEmail} · {item.action} · {formatDateTime(item.timestamp)}
            </p>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        )}
      </div>
    </ScrollArea>
  );
}
