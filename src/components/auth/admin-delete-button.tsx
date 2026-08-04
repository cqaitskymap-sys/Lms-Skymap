"use client";

import { useState, type ComponentProps } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RequireRole } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ButtonSize = ComponentProps<typeof Button>["size"];
type ButtonVariant = ComponentProps<typeof Button>["variant"];

interface AdminDeleteButtonProps {
  /** Async delete handler — called after confirmation */
  onDelete: () => Promise<void>;
  /** Optional label next to the icon (default: icon-only) */
  label?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  successMessage?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
  /** Stop click from bubbling (e.g. inside clickable cards/rows) */
  stopPropagation?: boolean;
}

/**
 * Delete control visible only to Super Admin.
 * Other roles never see this button.
 */
export function AdminDeleteButton({
  onDelete,
  label,
  confirmTitle = "Delete permanently?",
  confirmDescription = "This cannot be undone. Only Super Admin can delete records.",
  successMessage = "Deleted",
  size = "icon",
  variant = "ghost",
  className,
  stopPropagation = true,
}: AdminDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onDelete();
      toast.success(successMessage);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequireRole roles="super_admin" hideOnDeny>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn(
          // Ghost/outline: tint icon/label red. Destructive variant already has
          // light foreground — do not override or text vanishes on red bg.
          variant !== "destructive" && "text-destructive hover:text-destructive",
          className
        )}
        title="Delete (Super Admin)"
        aria-label={label || "Delete"}
        onClick={(e) => {
          if (stopPropagation) {
            e.preventDefault();
            e.stopPropagation();
          }
          setOpen(true);
        }}
      >
        <Trash2 className={cn("h-4 w-4", label && "mr-1.5")} />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent
          onClick={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => busy && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>{confirmDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void handleConfirm()}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireRole>
  );
}
