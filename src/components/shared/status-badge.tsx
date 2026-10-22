"use client";

import { cn, statusColor } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
  /** Override the auto-generated label (underscores → spaces). */
  label?: string;
}

export function StatusBadge({ status, className, label }: StatusBadgeProps) {
  const text = label ?? status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "status-chip inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        statusColor(status),
        className
      )}
    >
      {text}
    </span>
  );
}
