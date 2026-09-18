"use client";

import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";

export function OjtPageHint({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className="flex gap-3 rounded-xl border border-sky-200/80 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className="text-sky-900/80 dark:text-sky-100/80">{children}</div>
      </div>
    </aside>
  );
}
