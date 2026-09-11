"use client";

import type { ComponentProps } from "react";
import { Pencil } from "lucide-react";
import { RequireRole } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonSize = ComponentProps<typeof Button>["size"];
type ButtonVariant = ComponentProps<typeof Button>["variant"];

interface AdminEditButtonProps {
  onClick: () => void;
  label?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
  stopPropagation?: boolean;
}

/**
 * Edit control visible only to Super Admin.
 * Other roles never see this button.
 */
export function AdminEditButton({
  onClick,
  label,
  size = "icon",
  variant = "ghost",
  className,
  stopPropagation = true,
}: AdminEditButtonProps) {
  return (
    <RequireRole roles="super_admin" hideOnDeny>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn(className)}
        title="Edit (Super Admin)"
        aria-label={label || "Edit"}
        onClick={(e) => {
          if (stopPropagation) {
            e.preventDefault();
            e.stopPropagation();
          }
          onClick();
        }}
      >
        <Pencil className={cn("h-4 w-4", label && "mr-1.5")} />
        {label}
      </Button>
    </RequireRole>
  );
}
