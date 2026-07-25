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
  Settings,
  Building2,
  UserCog,
  UserPlus,
  HelpCircle,
  Briefcase,
  Target,
  Calendar,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import type { UserRole } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "hr", "qa", "department_head", "trainer", "employee"],
  },
  {
    title: "Employees",
    href: "/dashboard/employees",
    icon: Users,
    roles: ["super_admin", "hr", "department_head", "qa"],
  },
  {
    title: "Onboard employee",
    href: "/dashboard/employees/new",
    icon: UserPlus,
    roles: ["super_admin", "hr"],
  },
  {
    title: "Induction",
    href: "/dashboard/induction",
    icon: GraduationCap,
    roles: ["super_admin", "hr", "employee"],
  },
  {
    title: "Departments",
    href: "/dashboard/departments",
    icon: Building2,
    roles: ["super_admin", "hr", "qa"],
  },
  {
    title: "Job Descriptions",
    href: "/dashboard/jd",
    icon: Briefcase,
    roles: ["super_admin", "department_head", "employee", "hr"],
  },
  {
    title: "TNI",
    href: "/dashboard/tni",
    icon: Target,
    roles: ["super_admin", "department_head", "hr"],
  },
  {
    title: "SOPs",
    href: "/dashboard/sops",
    icon: FileText,
    roles: ["super_admin", "qa", "department_head", "trainer", "employee"],
  },
  {
    title: "Trainers",
    href: "/dashboard/trainers",
    icon: UserCog,
    roles: ["super_admin", "department_head", "hr", "qa"],
  },
  {
    title: "Training",
    href: "/dashboard/training",
    icon: Calendar,
    roles: ["super_admin", "department_head", "trainer", "employee", "hr", "qa"],
  },
  {
    title: "Training Matrix",
    href: "/dashboard/matrix",
    icon: ClipboardList,
    roles: ["super_admin", "qa", "department_head", "hr"],
  },
  {
    title: "Question Bank",
    href: "/dashboard/questions",
    icon: HelpCircle,
    roles: ["super_admin", "qa", "hr"],
  },
  {
    title: "Assessments",
    href: "/dashboard/exams",
    icon: BookOpen,
    roles: ["super_admin", "qa", "hr", "employee"],
  },
  {
    title: "Certificates",
    href: "/dashboard/certificates",
    icon: Award,
    roles: ["super_admin", "hr", "qa", "department_head", "employee", "trainer"],
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    roles: ["super_admin", "hr", "qa", "department_head"],
  },
  {
    title: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    roles: ["super_admin", "hr", "qa", "department_head", "trainer", "employee"],
  },
  {
    title: "Audit Trail",
    href: "/dashboard/audit",
    icon: Shield,
    roles: ["super_admin", "hr", "qa"],
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["super_admin"],
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role, user } = useAuth();

  // If profile/role hasn't loaded yet, still show full admin menu so sidebar isn't blank
  const effectiveRole: UserRole = role ?? (user ? "super_admin" : "employee");
  const items = NAV_ITEMS.filter((item) => item.roles.includes(effectiveRole));

  const content = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-accent text-white text-xs font-bold">
            PL
          </div>
          <span className="text-sm">PharmaLMS</span>
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
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
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
