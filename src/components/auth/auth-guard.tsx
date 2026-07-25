"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  hasAnyPermission,
  hasPermission,
  ROLE_DASHBOARD_ROUTES,
} from "@/lib/rbac/permissions";
import { matchRouteRule } from "@/lib/auth/route-permissions";
import { needsFirstLoginOnboarding } from "@/lib/services/onboarding";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const onOnboardingPath = pathname.startsWith("/dashboard/onboarding");

  const access = useMemo(() => {
    if (!profile || !role) return { ok: false as const, reason: "unauthenticated" };
    if (profile.isActive === false) return { ok: false as const, reason: "inactive" };

    if (onOnboardingPath) return { ok: true as const };

    const rule = matchRouteRule(pathname);
    if (!rule) return { ok: true as const };

    if (rule.anyAuthenticated) return { ok: true as const };

    if (rule.roles?.length && rule.roles.includes(role)) {
      return { ok: true as const };
    }

    if (rule.permissions?.length) {
      if (hasAnyPermission(role, rule.permissions)) return { ok: true as const };
    }

    if (!rule.roles?.length && !rule.permissions?.length) {
      return { ok: true as const };
    }

    return { ok: false as const, reason: "forbidden" };
  }, [pathname, profile, role, onOnboardingPath]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (profile && profile.isActive === false) {
      router.replace("/login?error=deactivated");
      return;
    }
    if (needsFirstLoginOnboarding(profile) && !onOnboardingPath) {
      router.replace("/dashboard/onboarding");
      return;
    }
    if (
      profile?.mustChangePassword &&
      !needsFirstLoginOnboarding(profile) &&
      !pathname.startsWith("/dashboard/settings") &&
      !onOnboardingPath
    ) {
      router.replace("/dashboard/settings?tab=password&reason=required");
      return;
    }
    if (access.reason === "forbidden") {
      router.replace(`/dashboard/unauthorized?from=${encodeURIComponent(pathname)}`);
    }
  }, [user, profile, loading, router, pathname, access.reason, onOnboardingPath]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;
  if (access.reason === "forbidden" || access.reason === "inactive") return null;

  return <>{children}</>;
}

export function useRoleDashboardRedirect() {
  const { role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role && role !== "super_admin") {
      const route = ROLE_DASHBOARD_ROUTES[role];
      if (route && route !== "/dashboard") {
        router.replace(route);
      }
    }
  }, [role, router]);
}

/** Hook for permission-gated UI without a wrapper component. */
export function usePermission(permission: Parameters<typeof hasPermission>[1]) {
  const { role } = useAuth();
  return Boolean(role && hasPermission(role, permission));
}
