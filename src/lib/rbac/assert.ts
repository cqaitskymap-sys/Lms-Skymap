import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "@/lib/rbac/permissions";
import type { UserRole } from "@/types";

export class AuthorizationError extends Error {
  status = 403;
  constructor(message = "Forbidden: insufficient permissions") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function assertPermission(role: UserRole | null | undefined, permission: Permission): void {
  if (!role || !hasPermission(role, permission)) {
    throw new AuthorizationError();
  }
}

export function assertAnyPermission(
  role: UserRole | null | undefined,
  permissions: Permission[]
): void {
  if (!role || !hasAnyPermission(role, permissions)) {
    throw new AuthorizationError();
  }
}

export function assertAllPermissions(
  role: UserRole | null | undefined,
  permissions: Permission[]
): void {
  if (!role || !hasAllPermissions(role, permissions)) {
    throw new AuthorizationError();
  }
}

export function assertRole(
  role: UserRole | null | undefined,
  allowed: UserRole | UserRole[]
): void {
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!role || !list.includes(role)) {
    throw new AuthorizationError("Forbidden: role not permitted");
  }
}
