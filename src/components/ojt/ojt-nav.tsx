"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calendar,
  ClipboardList,
  FileBarChart,
  HardHat,
  LayoutGrid,
  ListChecks,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";

const LINKS: {
  href: string;
  label: string;
  hint: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
  permission?: Permission;
  step?: string;
}[] = [
  { href: "/dashboard/ojt", label: "Home", hint: "Start here", icon: LayoutGrid, exact: true },
  { href: "/dashboard/ojt/topics", label: "Topics", hint: "What jobs to train", icon: HardHat, permission: "ojt:write", step: "1" },
  { href: "/dashboard/ojt/planner", label: "Plan months", hint: "When to choose people and train", icon: Calendar, permission: "ojt:write", step: "2" },
  { href: "/dashboard/ojt/matrix", label: "Select people", hint: "Who needs each topic", icon: ClipboardList, permission: "ojt:assign", step: "3" },
  { href: "/dashboard/ojt/schedule", label: "Book date", hint: "Trainer, day and room", icon: BookOpen, permission: "ojt:schedule", step: "4" },
  { href: "/dashboard/ojt/execution", label: "Train", hint: "Show the job and score", icon: PlayCircle, permission: "ojt:conduct", step: "5" },
  { href: "/dashboard/ojt/assignments", label: "All records", hint: "Every person’s OJT", icon: ListChecks },
  { href: "/dashboard/ojt/reports", label: "Reports", hint: "Print and export", icon: FileBarChart, permission: "ojt:export" },
];

export function OjtNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  const visible = LINKS.filter((link) => {
    if (!link.permission) return true;
    return !!role && hasPermission(role, link.permission);
  });

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1" aria-label="OJT steps">
      {visible.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            title={link.hint}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {link.step ? (
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                  active ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"
                )}
              >
                {link.step}
              </span>
            ) : (
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
            )}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
