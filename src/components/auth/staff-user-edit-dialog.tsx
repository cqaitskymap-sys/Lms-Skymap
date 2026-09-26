"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/hooks/use-departments";
import { ModuleAccessPicker } from "@/components/auth/module-access-picker";
import { employeeContactEmail } from "@/lib/auth/onboarding-schemas";
import {
  PROVISIONABLE_ROLES,
  updateAdminUserSchema,
  type UpdateAdminUserInput,
} from "@/lib/auth/user-admin-schemas";
import {
  defaultAllowedModules,
  normalizeAllowedModules,
  selectableModulesForRole,
  type AppModule,
} from "@/lib/rbac/modules";
import type { UserProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLE_LABELS: Record<(typeof PROVISIONABLE_ROLES)[number], string> = {
  super_admin: "Admin",
  hr: "HR",
  qa: "QA",
  department_head: "Department Head",
  trainer: "Trainer",
};

interface StaffUserEditDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, data: UpdateAdminUserInput) => Promise<void>;
}

export function StaffUserEditDialog({
  user,
  open,
  onOpenChange,
  onSave,
}: StaffUserEditDialogProps) {
  const { activeDepartments } = useDepartments();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateAdminUserInput>({
    resolver: zodResolver(updateAdminUserSchema),
  });

  const role = watch("role");
  const departmentId = watch("departmentId");
  const allowedModules = watch("allowedModules");

  useEffect(() => {
    if (!user || !open) return;
    const nextRole = PROVISIONABLE_ROLES.includes(user.role as (typeof PROVISIONABLE_ROLES)[number])
      ? (user.role as UpdateAdminUserInput["role"])
      : "hr";
    reset({
      displayName: user.displayName,
      email: employeeContactEmail(user),
      phone: user.phone || "",
      role: nextRole,
      departmentId: user.departmentId || "",
      allowedModules: user.allowedModules
        ? normalizeAllowedModules(nextRole!, user.allowedModules)
        : defaultAllowedModules(nextRole!),
    });
  }, [user, open, reset]);

  const onRoleChange = (v: UpdateAdminUserInput["role"]) => {
    if (!v) return;
    setValue("role", v, { shouldValidate: true });
    if (v !== "department_head" && v !== "trainer") {
      setValue("departmentId", "", { shouldValidate: true });
    }
    const optionalIds = new Set(selectableModulesForRole(v).map((m) => m.id));
    const currentOptional = (allowedModules ?? []).filter((id) => optionalIds.has(id as AppModule));
    setValue(
      "allowedModules",
      currentOptional.length > 0
        ? normalizeAllowedModules(v, currentOptional)
        : defaultAllowedModules(v),
      { shouldValidate: true }
    );
  };

  const onSubmit = async (data: UpdateAdminUserInput) => {
    if (!user) return;
    const payload: UpdateAdminUserInput = { ...data };
    if (payload.role && payload.role !== "department_head" && payload.role !== "trainer") {
      payload.departmentId = "";
    }
    await onSave(user.uid, payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit staff account</DialogTitle>
          <DialogDescription>
            Update profile and module access for {user?.displayName}. Sign-in stays the staff ID.
            Work email is contact only and can be shared.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Work email (optional)</Label>
            <Input
              id="edit-email"
              type="email"
              placeholder="hr@company.com"
              autoComplete="off"
              disabled={isSubmitting}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              The same address can be used for different employees. Sign-in stays the staff ID.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-displayName">Full name</Label>
            <Input id="edit-displayName" {...register("displayName")} />
            {errors.displayName && (
              <p className="text-xs text-destructive">{errors.displayName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input id="edit-phone" placeholder="+91 …" {...register("phone")} />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => onRoleChange(v as UpdateAdminUserInput["role"])}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {PROVISIONABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            )}
          </div>

          {(role === "department_head" || role === "trainer") && (
            <div className="space-y-2">
              <Label>Department {role === "department_head" ? "" : "(optional)"}</Label>
              <Select
                value={departmentId || ""}
                onValueChange={(v) => setValue("departmentId", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {activeDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.departmentId && (
                <p className="text-xs text-destructive">{errors.departmentId.message}</p>
              )}
            </div>
          )}

          {role === "super_admin" ? (
            <p className="text-sm text-muted-foreground">
              Admin accounts can open every module, including User Management.
            </p>
          ) : (
            role && (
              <ModuleAccessPicker
                role={role}
                value={(allowedModules ?? []) as AppModule[]}
                onChange={(modules) =>
                  setValue("allowedModules", modules, { shouldValidate: true })
                }
                error={errors.allowedModules?.message}
                disabled={isSubmitting}
              />
            )
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
