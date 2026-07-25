"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { CredentialsCard } from "@/components/onboarding/credentials-card";
import { useAuth } from "@/contexts/auth-context";
import { DEMO_DEPARTMENTS } from "@/lib/demo/data";
import {
  onboardEmployeeSchema,
  EMPLOYMENT_TYPES,
  type OnboardEmployeeInput,
} from "@/lib/auth/onboarding-schemas";
import { onboardEmployee, type OnboardResult } from "@/lib/services/onboarding";
import { listEmployeesForLifecycle } from "@/lib/services/lifecycle";
import type { Employee, UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";

const EMPLOYMENT_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  permanent: "Permanent",
  contract: "Contract",
  intern: "Intern",
  consultant: "Consultant",
  temporary: "Temporary",
};

export default function NewEmployeePage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [managers, setManagers] = useState<Employee[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OnboardEmployeeInput>({
    resolver: zodResolver(onboardEmployeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      departmentId: "",
      designation: "",
      dateOfJoining: new Date().toISOString().slice(0, 10),
      reportingManagerId: "",
      reportingManagerName: "",
      employmentType: "permanent",
      emailCredentials: true,
    },
  });

  const departmentId = watch("departmentId");
  const employmentType = watch("employmentType");
  const reportingManagerId = watch("reportingManagerId");
  const emailCredentials = watch("emailCredentials");

  useEffect(() => {
    void listEmployeesForLifecycle().then(setManagers);
  }, []);

  const managerOptions = useMemo(
    () =>
      managers.filter(
        (e) =>
          e.status !== "terminated" &&
          e.status !== "inactive" &&
          ["handed_over", "active", "qualified", "verified", "induction_complete"].includes(
            e.status
          )
      ),
    [managers]
  );

  const onSubmit = async (data: OnboardEmployeeInput) => {
    if (!profile) return;
    try {
      const dept = DEMO_DEPARTMENTS.find((d) => d.id === data.departmentId);
      const manager = managers.find((m) => m.id === data.reportingManagerId);

      const onboarded = await onboardEmployee(
        {
          ...data,
          departmentName: dept?.name,
          reportingManagerName: manager
            ? `${manager.firstName} ${manager.lastName}`
            : data.reportingManagerName,
        },
        {
          uid: profile.uid,
          name: profile.displayName,
          role: profile.role as UserRole,
          email: profile.email,
        }
      );

      setResult(onboarded);
      toast.success(`Onboarded ${onboarded.employee.firstName} ${onboarded.employee.lastName}`, {
        description: `Code ${onboarded.credentials.employeeCode} · Auth account created`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onboarding failed");
    }
  };

  if (result) {
    return (
      <RequirePermission permission="employees:write">
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Employee onboarded</h1>
            <p className="text-muted-foreground">
              Account provisioned. Next: verify documents, then assign induction modules.
            </p>
          </div>
          <CredentialsCard
            credentials={result.credentials}
            employeeName={`${result.employee.firstName} ${result.employee.lastName}`}
            emailStatus={result.email}
            onDone={() => router.push(`/dashboard/employees/${result.employee.id}`)}
          />
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/induction?assign=${result.employee.id}`)}
          >
            Assign induction modules
          </Button>
        </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission permission="employees:write">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employee onboarding</h1>
          <p className="text-muted-foreground">
            Creates profile, generates EMP code & credentials, and provisions authentication
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              New hire details
            </CardTitle>
            <CardDescription>
              Employee code (EMP000001), username, and temporary password are generated
              automatically. The hire must change password, update profile, and accept policies on
              first login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
              <div className="space-y-2">
                <Label htmlFor="firstName">Employee name (first)</Label>
                <Input id="firstName" {...register("firstName")} autoComplete="off" />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" {...register("lastName")} autoComplete="off" />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={departmentId || undefined}
                  onValueChange={(v) => setValue("departmentId", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_DEPARTMENTS.map((d) => (
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
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" {...register("designation")} />
                {errors.designation && (
                  <p className="text-xs text-destructive">{errors.designation.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfJoining">Date of joining</Label>
                <Input id="dateOfJoining" type="date" {...register("dateOfJoining")} />
                {errors.dateOfJoining && (
                  <p className="text-xs text-destructive">{errors.dateOfJoining.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Employment type</Label>
                <Select
                  value={employmentType}
                  onValueChange={(v) =>
                    setValue("employmentType", v as OnboardEmployeeInput["employmentType"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {EMPLOYMENT_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} autoComplete="off" />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="mobile">Mobile number</Label>
                <Input id="mobile" {...register("mobile")} placeholder="+91 …" />
                {errors.mobile && (
                  <p className="text-xs text-destructive">{errors.mobile.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Reporting manager</Label>
                <Select
                  value={reportingManagerId || "none"}
                  onValueChange={(v) => {
                    const id = v === "none" ? "" : v;
                    setValue("reportingManagerId", id);
                    const m = managers.find((x) => x.id === id);
                    setValue(
                      "reportingManagerName",
                      m ? `${m.firstName} ${m.lastName}` : ""
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / assign later</SelectItem>
                    {managerOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} · {m.employeeCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-3 sm:col-span-2">
                <Checkbox
                  id="emailCredentials"
                  checked={Boolean(emailCredentials)}
                  onCheckedChange={(c) => setValue("emailCredentials", c === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="emailCredentials" className="cursor-pointer">
                    Email login credentials to me (HR)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Requires RESEND_API_KEY. Credentials are always shown on the next screen.
                  </p>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={isSubmitting} className="min-w-[200px]">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create employee & account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
