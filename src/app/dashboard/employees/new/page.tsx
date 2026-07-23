"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RequirePermission } from "@/components/auth/require-permission";
import { DEMO_DEPARTMENTS } from "@/lib/demo/data";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NewEmployeePage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    designation: "",
    departmentId: "",
    dateOfJoining: new Date().toISOString().slice(0, 10),
    employeeCode: "",
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Demo: simulate create
      await new Promise((r) => setTimeout(r, 600));
      toast.success(`Employee ${form.firstName} ${form.lastName} created`, {
        description: `Created by ${profile?.email}. Assign induction modules next.`,
      });
      router.push("/dashboard/employees");
    } catch {
      toast.error("Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequirePermission permission="employees:write">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New employee</h1>
          <p className="text-muted-foreground">Create profile and begin induction workflow</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Employee details</CardTitle>
            <CardDescription>HR creates the profile before induction assignment</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email</Label>
                <Input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Employee code</Label>
                <Input required placeholder="EMP-QA-0004" value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input required value={form.designation} onChange={(e) => set("designation", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date of joining</Label>
                <Input required type="date" value={form.dateOfJoining} onChange={(e) => set("dateOfJoining", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Intended department</Label>
                <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v)}>
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
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving…" : "Create employee"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
