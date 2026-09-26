"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useDepartments } from "@/hooks/use-departments";
import {
  updateEmployeeProfileSchema,
  type UpdateEmployeeProfileInput,
} from "@/lib/auth/onboarding-schemas";
import { saveEmployeeProfile } from "@/lib/services/employees";
import { listDepartmentHeads } from "@/lib/services/users";
import type { Employee, UserProfile, UserRole } from "@/types";
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

function editableEmail(employee: Employee): string {
  const derived = `${employee.employeeCode.trim().toLowerCase()}@pharma.local`;
  if (employee.email.trim().toLowerCase() === derived) return "";
  return employee.email;
}

function toFormValues(employee: Employee): UpdateEmployeeProfileInput {
  return {
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName || "",
    email: editableEmail(employee),
    mobile: employee.mobile || employee.phone || "",
    departmentId: employee.departmentId || "",
    departmentName: employee.departmentName,
    designation: employee.designation,
    dateOfJoining: (employee.dateOfJoining || "").slice(0, 10),
    reportingManagerId: employee.reportingManagerId || "",
    reportingManagerName: employee.reportingManagerName || "",
    employmentType: "permanent",
  };
}

export function EditEmployeeDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile } = useAuth();
  const { activeDepartments, loading: deptLoading } = useDepartments();
  const [departmentHeads, setDepartmentHeads] = useState<UserProfile[]>([]);
  const [employeeName, setEmployeeName] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateEmployeeProfileInput>({
    resolver: zodResolver(updateEmployeeProfileSchema),
    defaultValues: {
      employeeCode: "",
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      departmentId: "",
      designation: "",
      dateOfJoining: "",
      reportingManagerId: "",
      reportingManagerName: "",
      employmentType: "permanent",
    },
  });

  const departmentId = watch("departmentId");
  const reportingManagerId = watch("reportingManagerId");
  const reportingManagerName = watch("reportingManagerName");
  const loadedDepartmentId = useRef("");
  const openedForId = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void listDepartmentHeads()
      .then(setDepartmentHeads)
      .catch(() => setDepartmentHeads([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      openedForId.current = null;
      return;
    }
    if (!employee || openedForId.current === employee.id) return;
    openedForId.current = employee.id;
    reset(toFormValues(employee));
    loadedDepartmentId.current = employee.departmentId || "";
    setEmployeeName(`${employee.firstName} ${employee.lastName || ""}`.trim());
  }, [open, employee, reset]);

  const departmentOptions = useMemo(() => {
    const options = activeDepartments.map((d) => ({ id: d.id, name: d.name }));
    if (departmentId && !options.some((d) => d.id === departmentId)) {
      options.unshift({
        id: departmentId,
        name: employee?.departmentName || "Current department",
      });
    }
    return options;
  }, [activeDepartments, departmentId, employee?.departmentName]);

  const managerOptions = useMemo(() => {
    if (!departmentId) return [];
    const dept = activeDepartments.find((d) => d.id === departmentId);
    return departmentHeads.filter(
      (h) =>
        h.departmentId === departmentId ||
        (dept?.headUserId && (h.uid === dept.headUserId || h.id === dept.headUserId))
    );
  }, [departmentHeads, departmentId, activeDepartments]);

  const managerListed = managerOptions.some(
    (h) => h.uid === reportingManagerId || h.id === reportingManagerId
  );

  useEffect(() => {
    if (!open || !reportingManagerId) return;
    if (departmentHeads.length === 0) return;
    if (departmentId === loadedDepartmentId.current) return;
    if (!managerListed) {
      setValue("reportingManagerId", "");
      setValue("reportingManagerName", "");
    }
  }, [
    open,
    departmentId,
    departmentHeads.length,
    managerListed,
    reportingManagerId,
    setValue,
  ]);

  const onSubmit = async (data: UpdateEmployeeProfileInput) => {
    if (!employee || !profile) return;
    try {
      const dept = activeDepartments.find((d) => d.id === data.departmentId);
      const manager = departmentHeads.find(
        (m) => m.uid === data.reportingManagerId || m.id === data.reportingManagerId
      );
      await saveEmployeeProfile(
        employee.id,
        {
          ...data,
          employmentType: "permanent",
          departmentName: dept?.name || data.departmentName,
          reportingManagerName: manager?.displayName || data.reportingManagerName || "",
        },
        {
          uid: profile.uid,
          name: profile.displayName,
          role: profile.role as UserRole,
        }
      );
      toast.success(`Updated ${data.firstName} ${data.lastName}`.trim());
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update employee";
      toast.error(message);
      const match = message.match(/^(\w+): /);
      if (match) {
        const field = match[1] as keyof UpdateEmployeeProfileInput;
        setError(field, { message: message.replace(/^[^:]+:\s*/, "") });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription>
            Update the profile created at onboarding. Lifecycle stage stays the same. Employee code
            is also the login username.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-employeeCode">Employee code</Label>
            <Input
              id="edit-employeeCode"
              {...register("employeeCode", {
                onChange: (e) => {
                  e.target.value = e.target.value.toUpperCase();
                },
              })}
              autoComplete="off"
              className="uppercase"
            />
            {errors.employeeCode && (
              <p className="text-xs text-destructive">{errors.employeeCode.message}</p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-employeeName">Employee name</Label>
            <Input
              id="edit-employeeName"
              value={employeeName}
              autoComplete="name"
              onChange={(e) => {
                const value = e.target.value;
                setEmployeeName(value);
                const trimmed = value.trim().replace(/\s+/g, " ");
                const [first = "", ...rest] = trimmed ? trimmed.split(" ") : [];
                setValue("firstName", first, { shouldValidate: true });
                setValue("lastName", rest.join(" "), { shouldValidate: true });
              }}
            />
            {(errors.firstName || errors.lastName) && (
              <p className="text-xs text-destructive">
                {errors.firstName?.message || errors.lastName?.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={departmentId || undefined}
              onValueChange={(v) => setValue("departmentId", v, { shouldValidate: true })}
              disabled={deptLoading || departmentOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={deptLoading ? "Loading…" : "Select department"} />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.departmentId && (
              <p className="text-xs text-destructive">{errors.departmentId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-designation">Designation</Label>
            <Input id="edit-designation" {...register("designation")} />
            {errors.designation && (
              <p className="text-xs text-destructive">{errors.designation.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-dateOfJoining">Date of joining</Label>
            <Input id="edit-dateOfJoining" type="date" {...register("dateOfJoining")} />
            {errors.dateOfJoining && (
              <p className="text-xs text-destructive">{errors.dateOfJoining.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-employmentType">Employment type</Label>
            <Input id="edit-employmentType" value="Permanent" readOnly disabled />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-email">Email (optional)</Label>
            <Input id="edit-email" type="email" {...register("email")} autoComplete="off" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            <p className="text-xs text-muted-foreground">
              Leave blank to keep login as <span className="font-mono">code@pharma.local</span>
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-mobile">Mobile number (optional)</Label>
            <Input id="edit-mobile" {...register("mobile")} placeholder="+91 …" />
            {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Reporting manager</Label>
            <Select
              value={reportingManagerId || "none"}
              onValueChange={(v) => {
                const id = v === "none" ? "" : v;
                setValue("reportingManagerId", id);
                const m = departmentHeads.find((x) => x.uid === id || x.id === id);
                setValue("reportingManagerName", m?.displayName || "");
              }}
              disabled={!departmentId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    departmentId ? "Select department head (optional)" : "Select department first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / assign later</SelectItem>
                {reportingManagerId && !managerListed && (
                  <SelectItem value={reportingManagerId}>
                    {reportingManagerName || "Current manager"}
                  </SelectItem>
                )}
                {managerOptions.map((m) => (
                  <SelectItem key={m.uid || m.id} value={m.uid || m.id}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !employee}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
