"use client";

import { Archive, CheckCircle2, Clock, GitBranch } from "lucide-react";
import type { SopVersion } from "@/types";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SopVersionHistoryProps {
  versions: SopVersion[];
  currentVersionId?: string;
  selectedId?: string;
  onSelect?: (version: SopVersion) => void;
  onArchive?: (version: SopVersion) => void;
  canArchive?: boolean;
}

export function SopVersionHistory({
  versions,
  currentVersionId,
  selectedId,
  onSelect,
  onArchive,
  canArchive,
}: SopVersionHistoryProps) {
  return (
    <div className="relative space-y-0 pl-5">
      <div className="absolute bottom-2 left-2 top-2 w-px bg-border" />
      {versions.map((v) => {
        const isCurrent = v.id === currentVersionId;
        const selected = v.id === selectedId;
        return (
          <div key={v.id} className="relative pb-4 last:pb-0">
            <div
              className={cn(
                "absolute -left-[0.85rem] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background",
                isCurrent ? "text-primary" : "text-muted-foreground"
              )}
            >
              {v.status === "approved" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : v.status === "obsolete" || v.status === "superseded" ? (
                <Archive className="h-3.5 w-3.5" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelect?.(v)}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                selected && "border-primary bg-primary/5"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold">v{v.versionNumber}</span>
                  {isCurrent && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      CURRENT
                    </span>
                  )}
                </div>
                <StatusBadge status={v.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{v.changeSummary}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatDateTime(v.approvedAt || v.createdAt)}
                {v.approvedByName ? ` · ${v.approvedByName}` : ""}
                {" · "}
                {formatBytes(v.fileSize)}
                {v.retrainAssignedCount
                  ? ` · ${v.retrainAssignedCount} retrains`
                  : ""}
              </p>
              {v.archivedAt && (
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                  Archived {formatDateTime(v.archivedAt)}
                  {v.obsoleteReason ? ` — ${v.obsoleteReason}` : ""}
                </p>
              )}
            </button>
            {canArchive &&
              v.status === "approved" &&
              !isCurrent &&
              onArchive && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-7 text-xs"
                  onClick={() => onArchive(v)}
                >
                  <Archive className="mr-1 h-3 w-3" />
                  Archive
                </Button>
              )}
          </div>
        );
      })}
    </div>
  );
}
