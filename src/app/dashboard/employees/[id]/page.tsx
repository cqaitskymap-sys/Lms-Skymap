"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DEMO_EMPLOYEES, DEMO_DEPARTMENTS, DEMO_INDUCTION_MODULES } from "@/lib/demo/data";
import { StatusBadge } from "@/components/shared/status-badge";
import { RequirePermission } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const employee = DEMO_EMPLOYEES.find((e) => e.id === id);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [handoverDept, setHandoverDept] = useState(employee?.departmentId || "");

  if (!employee) {
    return <p className="text-muted-foreground">Employee not found.</p>;
  }

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    );
  };

  return (
    <RequirePermission permission="employees:read">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-muted-foreground">
              {employee.employeeCode} · {employee.designation}
            </p>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={employee.status} />
            <StatusBadge status={employee.inductionStatus} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{employee.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date of joining</p>
                <p className="font-medium">{formatDate(employee.dateOfJoining)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Department</p>
                <p className="font-medium">
                  {DEMO_DEPARTMENTS.find((d) => d.id === employee.departmentId)?.name || "Unassigned"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Induction completed</p>
                <p className="font-medium">{formatDate(employee.inductionCompletedAt)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assign induction</CardTitle>
              <CardDescription>HR selects modules and documents for onboarding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {DEMO_INDUCTION_MODULES.map((m) => (
                <div key={m.id} className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    id={m.id}
                    checked={selectedModules.includes(m.id)}
                    onCheckedChange={() => toggleModule(m.id)}
                  />
                  <div>
                    <Label htmlFor={m.id} className="font-medium">
                      {m.title}
                    </Label>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                </div>
              ))}
              <Button
                onClick={() => {
                  if (!selectedModules.length) {
                    toast.error("Select at least one module");
                    return;
                  }
                  toast.success("Induction modules assigned");
                }}
              >
                Assign modules
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Department handover</CardTitle>
              <CardDescription>
                Available after induction assessment is passed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={handoverDept} onValueChange={setHandoverDept}>
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
              <Button
                disabled={employee.inductionStatus !== "passed" && employee.status !== "active"}
                onClick={() => toast.success("Employee handed over to department")}
              >
                Complete handover
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>1. Assign induction modules & upload documents</p>
              <p>2. Employee completes induction + assessment</p>
              <p>3. HR hands over to department</p>
              <p>4. Dept Head creates JD & TNI</p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/jd">Open JD</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/tni">Open TNI</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequirePermission>
  );
}
