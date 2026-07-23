"use client";

import { useAuth } from "@/contexts/auth-context";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

interface RequirePermissionProps {
  permission: Permission | Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({ permission, children, fallback }: RequirePermissionProps) {
  const { role } = useAuth();
  const permissions = Array.isArray(permission) ? permission : [permission];
  const allowed = role && permissions.some((p) => hasPermission(role, p));

  if (!allowed) {
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
