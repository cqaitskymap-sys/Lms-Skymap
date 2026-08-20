"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileText,
  ClipboardList,
  BookOpen,
  Award,
  BarChart3,
  Bell,
  Shield,
  ShieldCheck,
  Settings,
  Building2,
  UserCog,
  UserPlus,
  HelpCircle,
  Briefcase,
  Target,
  Calendar,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import type { UserRole } from "@/types";
import {
  APP_MODULE_DEFS,
  canAccessModule,
  type AppModule,
} from "@/lib/rbac/modules";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DeveloperCredit } from "@/components/shared/developer-credit";

const MODULE_ICONS: Record<AppModule, LucideIcon> = {
  dashboard: LayoutDashboard,
  employees: Users,
  employees_new: UserPlus,
  induction: GraduationCap,
  departments: Building2,
  jd: Briefcase,
  tni: Target,
  sops: FileText,
  trainers: UserCog,
  training: Calendar,
  matrix: ClipboardList,
  questions: HelpCircle,
  exams: BookOpen,
  certificates: Award,
  reports: BarChart3,
  notifications: Bell,
  audit: Shield,
  users: ShieldCheck,
  settings: Settings,
};

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role, user, profile } = useAuth();

  const effectiveRole: UserRole | null = role ?? null;
  const items = effectiveRole
    ? APP_MODULE_DEFS.filter(
        (item) =>
          item.roles.includes(effectiveRole) &&
          canAccessModule(effectiveRole, profile?.allowedModules, item.id)
      )
    : user
      ? APP_MODULE_DEFS.filter(
          (item) => item.id === "dashboard" || item.id === "settings"
        )
      : [];

  const content = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border/80 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/skymap-logo.png"
            alt="SKYMAP"
            className="h-8 w-auto max-w-[148px] object-contain"
          />
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" className="lg:hidden text-sidebar-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {items.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard" ||
                  pathname.startsWith("/dashboard/hr") ||
                  pathname.startsWith("/dashboard/qa") ||
                  pathname.startsWith("/dashboard/department") ||
                  pathname.startsWith("/dashboard/trainer") ||
                  pathname.startsWith("/dashboard/employee")
                : pathname === item.href ||
                  (item.id === "employees"
                    ? pathname.startsWith(`${item.href}/`) &&
                      !pathname.startsWith("/dashboard/employees/new")
                    : pathname.startsWith(`${item.href}/`));
            const Icon = MODULE_ICONS[item.id];
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-sidebar-foreground/65 hover:bg-white/5 hover:text-white"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    active
                      ? "bg-sidebar-accent text-white shadow-sm shadow-cyan-900/30"
                      : "bg-white/5 text-sidebar-foreground/70 group-hover:bg-white/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.title}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border/80 p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/40">
          GMP / GDP Compliant
        </p>
        <DeveloperCredit className="mt-1.5 text-sidebar-foreground/35" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 lg:block">{content}</aside>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-64 shadow-2xl">{content}</aside>
        </div>
      )}
    </>
  );
}
