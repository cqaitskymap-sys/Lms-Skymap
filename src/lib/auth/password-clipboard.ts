import type { ClipboardEvent, DragEvent } from "react";
import { toast } from "sonner";

/**
 * Block copy / cut / paste / drop on new + confirm password fields
 * so users must type them manually (temporary password still allows paste).
 */
export function blockPasswordClipboardProps(fieldLabel = "password") {
  const block = (e: ClipboardEvent | DragEvent) => {
    e.preventDefault();
    toast.error(`Copy/paste is disabled for ${fieldLabel} — please type it`);
  };

  return {
    onPaste: block as (e: ClipboardEvent<HTMLInputElement>) => void,
    onCopy: block as (e: ClipboardEvent<HTMLInputElement>) => void,
    onCut: block as (e: ClipboardEvent<HTMLInputElement>) => void,
    onDrop: block as (e: DragEvent<HTMLInputElement>) => void,
    autoComplete: "new-password" as const,
    // Discourage password managers from filling confirm from clipboard/autofill pair
    "data-lpignore": "true",
    "data-1p-ignore": "true",
  };
}
