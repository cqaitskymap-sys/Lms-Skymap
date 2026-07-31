"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/hooks/use-departments";
import {
  PROVISIONABLE_ROLES,
  updateAdminUserSchema,
  type UpdateAdminUserInput,
} from "@/lib/auth/user-admin-schemas";
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

  useEffect(() => {
    if (!user || !open) return;
    reset({
      displayName: user.displayName,
      phone: user.phone || "",
      role: PROVISIONABLE_ROLES.includes(user.role as (typeof PROVISIONABLE_ROLES)[number])
        ? (user.role as UpdateAdminUserInput["role"])
        : "hr",
      departmentId: user.departmentId || "",
    });
  }, [user, open, reset]);

  const onSubmit = async (data: UpdateAdminUserInput) => {
    if (!user) return;
    await onSave(user.uid, data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit staff account</DialogTitle>
          <DialogDescription>
            Update profile for {user?.displayName}. Email cannot be changed here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
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
            <Select
              value={role}
              onValueChange={(v) =>
                setValue("role", v as UpdateAdminUserInput["role"], { shouldValidate: true })
              }
            >
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
