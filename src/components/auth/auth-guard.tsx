"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  hasAnyPermission,
  hasPermission,
  ROLE_DASHBOARD_ROUTES,
} from "@/lib/rbac/permissions";
import { matchRouteRule } from "@/lib/auth/route-permissions";
import { canAccessPath } from "@/lib/rbac/modules";
import { needsFirstLoginOnboarding } from "@/lib/services/onboarding";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, role, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const signingOut = useRef(false);

  const onOnboardingPath = pathname.startsWith("/dashboard/onboarding");

  const access = useMemo(() => {
    if (!profile || !role) return { ok: false as const, reason: "unauthenticated" };
    if (profile.isActive === false) return { ok: false as const, reason: "inactive" };

    if (onOnboardingPath) return { ok: true as const };

    if (!canAccessPath(role, profile.allowedModules, pathname)) {
      return { ok: false as const, reason: "forbidden" };
    }

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
      const search = searchParams.toString();
      const nextPath = search ? `${pathname}?${search}` : pathname;
      router.replace(`/login?redirect=${encodeURIComponent(nextPath)}`);
      return;
    }
    if (profile && profile.isActive === false) {
      if (signingOut.current) return;
      signingOut.current = true;
      void signOut().finally(() => {
        router.replace("/login?error=deactivated");
      });
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
  }, [user, profile, loading, router, pathname, searchParams, access.reason, onOnboardingPath, signOut]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;
  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-medium">Could not load your account</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your profile did not load. Sign out and try again.
        </p>
        <button
          type="button"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    );
  }
  const needsOnboarding = Boolean(
    profile && needsFirstLoginOnboarding(profile) && !onOnboardingPath
  );
  const needsPassword =
    Boolean(profile?.mustChangePassword) &&
    !needsFirstLoginOnboarding(profile) &&
    !pathname.startsWith("/dashboard/settings") &&
    !onOnboardingPath;

  if (
    needsOnboarding ||
    needsPassword ||
    access.reason === "forbidden" ||
    access.reason === "inactive"
  ) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
