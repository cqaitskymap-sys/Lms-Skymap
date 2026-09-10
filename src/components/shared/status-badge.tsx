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
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        statusColor(status),
        className
      )}
    >
      {text}
    </span>
  );
}
