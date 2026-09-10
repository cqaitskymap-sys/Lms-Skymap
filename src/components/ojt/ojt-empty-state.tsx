"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OjtEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon: Icon = ClipboardList,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div className="max-w-md space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actionHref && actionLabel ? (
        <Button asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
