"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6",
};

/** Frosted glass panel for enterprise dashboards */
export function GlassCard({
  className,
  hover = false,
  padding = "md",
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-panel rounded-2xl",
        paddingMap[padding],
        hover && "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div>
        <h3 className="text-sm font-semibold tracking-tight md:text-base">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
