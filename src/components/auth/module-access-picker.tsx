"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  selectableModulesForRole,
  type AppModule,
} from "@/lib/rbac/modules";
import type { UserRole } from "@/types";

interface ModuleAccessPickerProps {
  role: UserRole;
  value: AppModule[];
  onChange: (modules: AppModule[]) => void;
  error?: string;
  disabled?: boolean;
}

export function ModuleAccessPicker({
  role,
  value,
  onChange,
  error,
  disabled,
}: ModuleAccessPickerProps) {
  const options = selectableModulesForRole(role);
  const selected = new Set(value);

  const toggle = (id: AppModule, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange([...next]);
  };

  const selectAll = () => {
    onChange(options.map((m) => m.id));
  };

  const clearOptional = () => {
    onChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>Module access</Label>
          <p className="text-xs text-muted-foreground">
            User will only see and use the modules you select. Dashboard, Notifications, and
            Settings are always included.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            className="text-primary hover:underline disabled:opacity-50"
            onClick={selectAll}
            disabled={disabled || options.length === 0}
          >
            Select all
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="text-muted-foreground hover:underline disabled:opacity-50"
            onClick={clearOptional}
            disabled={disabled}
          >
            Clear
          </button>
        </div>
      </div>

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">No optional modules for this role.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 rounded-md border p-3">
          {options.map((mod) => {
            const checked = selected.has(mod.id);
            return (
              <label
                key={mod.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(state) => toggle(mod.id, state === true)}
                />
                <span>{mod.title}</span>
              </label>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
