"use client";

import type { ReactNode } from "react";
import {
  CircleAlert,
  CircleCheck,
  Info,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function ToastIcon({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "error" | "warning" | "info" | "loading";
}) {
  return <span className={`toast-icon toast-icon--${tone}`}>{children}</span>;
}

export function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand
      visibleToasts={4}
      gap={14}
      offset={20}
      duration={4200}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group toast-item relative flex w-[min(100vw-2rem,23rem)] items-start gap-3.5 overflow-hidden rounded-2xl border px-4 py-3.5 pr-10",
          content: "flex min-w-0 flex-1 flex-col gap-1 pt-0.5",
          title:
            "text-[13.5px] font-semibold leading-snug tracking-[-0.01em] text-[inherit]",
          description: "text-[12.5px] leading-relaxed text-current/70",
          actionButton:
            "mt-1.5 inline-flex h-7 shrink-0 items-center rounded-lg bg-[hsl(var(--primary))] px-2.5 text-xs font-medium text-[hsl(var(--primary-foreground))] shadow-sm transition hover:brightness-110",
          cancelButton:
            "mt-1.5 inline-flex h-7 shrink-0 items-center rounded-lg bg-black/[0.04] px-2.5 text-xs font-medium transition hover:bg-black/[0.08] dark:bg-white/10 dark:hover:bg-white/15",
          closeButton:
            "absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full border-0 bg-transparent text-current/40 opacity-0 transition-all hover:bg-black/[0.06] hover:text-current group-hover:opacity-100 dark:hover:bg-white/10",
          icon: "shrink-0",
        },
      }}
      icons={{
        success: (
          <ToastIcon tone="success">
            <CircleCheck strokeWidth={2.4} />
          </ToastIcon>
        ),
        error: (
          <ToastIcon tone="error">
            <CircleAlert strokeWidth={2.4} />
          </ToastIcon>
        ),
        warning: (
          <ToastIcon tone="warning">
            <TriangleAlert strokeWidth={2.4} />
          </ToastIcon>
        ),
        info: (
          <ToastIcon tone="info">
            <Info strokeWidth={2.4} />
          </ToastIcon>
        ),
        loading: (
          <ToastIcon tone="loading">
            <Loader2 className="animate-spin" strokeWidth={2.4} />
          </ToastIcon>
        ),
        close: <X className="size-3.5" strokeWidth={2.4} />,
      }}
      {...props}
    />
  );
}
