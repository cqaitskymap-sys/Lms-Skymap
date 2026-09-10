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
}[] = [
  { href: "/dashboard/ojt", label: "Overview", hint: "Status at a glance", icon: LayoutGrid, exact: true },
  { href: "/dashboard/ojt/planner", label: "Yearly plan", hint: "S / E months", icon: Calendar, permission: "ojt:write" },
  { href: "/dashboard/ojt/matrix", label: "Who is trained", hint: "Employee × topic", icon: ClipboardList, permission: "ojt:assign" },
  { href: "/dashboard/ojt/assignments", label: "Records", hint: "Each person’s OJT", icon: ListChecks },
  { href: "/dashboard/ojt/schedule", label: "Book date", hint: "When & where", icon: BookOpen, permission: "ojt:schedule" },
  { href: "/dashboard/ojt/execution", label: "Conduct", hint: "Train & score", icon: PlayCircle, permission: "ojt:conduct" },
  { href: "/dashboard/ojt/topics", label: "Topics", hint: "Master list", icon: HardHat, permission: "ojt:write" },
  { href: "/dashboard/ojt/reports", label: "Reports", hint: "Export views", icon: FileBarChart, permission: "ojt:export" },
];

export function OjtNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  const visible = LINKS.filter((link) => {
    if (!link.permission) return true;
    return !!role && hasPermission(role, link.permission);
  });

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">
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
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
