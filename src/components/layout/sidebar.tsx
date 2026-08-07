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
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/skymap-logo.png"
            alt="SKYMAP"
            className="h-8 w-auto max-w-[140px] object-contain"
          />
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" className="lg:hidden text-sidebar-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-0.5">
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
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/50">
        GMP / GDP Compliant Training
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border lg:block">{content}</aside>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-60 shadow-xl">{content}</aside>
        </div>
      )}
    </>
  );
}
