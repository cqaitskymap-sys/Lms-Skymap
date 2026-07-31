"use client";

import { useAuth } from "@/contexts/auth-context";
import { hasAllPermissions, hasAnyPermission, type Permission } from "@/lib/rbac/permissions";
import type { UserRole } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

interface RequirePermissionProps {
  permission: Permission | Permission[];
  /** Require every permission when array is passed (default: any) */
  mode?: "any" | "all";
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Hide completely instead of showing access denied */
  hideOnDeny?: boolean;
}

export function RequirePermission({
  permission,
  mode = "any",
  children,
  fallback,
  hideOnDeny = false,
}: RequirePermissionProps) {
  const { role, profile } = useAuth();
  const permissions = Array.isArray(permission) ? permission : [permission];

  const allowed =
    Boolean(role) &&
    profile?.isActive !== false &&
    (mode === "all"
      ? hasAllPermissions(role!, permissions)
      : hasAnyPermission(role!, permissions));

  if (!allowed) {
    if (hideOnDeny) return null;
    return (
      fallback ?? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Access Denied</p>
            <p className="text-sm text-muted-foreground">
              You do not have permission to view this resource.
            </p>
          </CardContent>
        </Card>
      )
    );
  }

  return <>{children}</>;
}

interface RequireRoleProps {
  roles: UserRole | UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  hideOnDeny?: boolean;
}

export function RequireRole({ roles, children, fallback, hideOnDeny = false }: RequireRoleProps) {
  const { role, profile } = useAuth();
  const list = Array.isArray(roles) ? roles : [roles];
  const allowed = Boolean(role) && profile?.isActive !== false && list.includes(role!);

  if (!allowed) {
    if (hideOnDeny) return null;
    return (
      fallback ?? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Access Denied</p>
            <p className="text-sm text-muted-foreground">
              Your role cannot access this section.
            </p>
          </CardContent>
        </Card>
      )
    );
  }

  return <>{children}</>;
}

/** Conditionally render children when permission granted — no fallback UI. */
export function Can({
  permission,
  children,
}: {
  permission: Permission | Permission[];
  children: React.ReactNode;
}) {
  return (
    <RequirePermission permission={permission} hideOnDeny>
      {children}
    </RequirePermission>
  );
}
