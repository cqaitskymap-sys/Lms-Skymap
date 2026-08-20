"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Bell, LogOut, User, Lock } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useExamLockOptional } from "@/contexts/exam-lock-context";
import { ROLE_LABELS } from "@/lib/rbac/permissions";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  getUnreadNotificationCount,
  NOTIFICATIONS_UPDATED_EVENT,
} from "@/lib/services/notifications";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";

interface HeaderProps {
  onMenuClick?: () => void;
  examLocked?: boolean;
}

export function Header({ onMenuClick, examLocked = false }: HeaderProps) {
  const { profile, signOut } = useAuth();
  const { examTitle } = useExamLockOptional();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!profile?.uid) {
      setUnread(0);
      return;
    }
    try {
      setUnread(await getUnreadNotificationCount(profile.uid));
    } catch {
      /* non-blocking */
    }
  }, [profile?.uid]);

  useEffect(() => {
    if (examLocked) return;
    void refreshUnread();
    const onUpdate = () => void refreshUnread();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    const interval = window.setInterval(() => void refreshUnread(), 60_000);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
      window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
      window.clearInterval(interval);
    };
  }, [refreshUnread, examLocked]);

  if (examLocked) {
    return (
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-amber-500/40 bg-amber-50/90 px-4 backdrop-blur-xl dark:bg-amber-950/40">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-amber-900 dark:text-amber-100">
          <Lock className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              Exam locked{examTitle ? ` — ${examTitle}` : ""}
            </p>
            <p className="truncate text-xs opacity-80">
              Submit the assessment to unlock navigation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-medium text-amber-800 dark:text-amber-200 sm:inline">
            {profile?.displayName}
          </span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      {onMenuClick && (
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <div className="flex-1" />

      <ThemeToggle />

      <Button variant="ghost" size="icon" className="relative rounded-full" asChild>
        <Link href="/dashboard/notifications" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 gap-2 rounded-full px-1.5 pr-3">
            <Avatar className="h-8 w-8 ring-2 ring-border/70">
              <AvatarImage src={profile?.photoURL} />
              <AvatarFallback className="text-xs font-semibold">
                {getInitials(profile?.displayName || "U")}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left md:block">
              <p className="text-sm font-semibold leading-none">{profile?.displayName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {profile?.role ? ROLE_LABELS[profile.role] : ""}
              </p>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <User className="mr-2 h-4 w-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings?tab=password">Change password</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await signOut();
              window.location.href = "/login";
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
