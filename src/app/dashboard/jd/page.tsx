"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { draftJdWithAi } from "@/lib/services/ai";
import { createJobDescription } from "@/lib/services/training";
import {
  createJdLifecycle,
  listEmployeesForLifecycle,
  type LifecycleActor,
} from "@/lib/services/lifecycle";
import { listDepartments, departmentLabel } from "@/lib/services/departments";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department, Employee, UserRole } from "@/types";

export default function JdPage() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [skills, setSkills] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [busy, setBusy] = useState(false);

  const actor: LifecycleActor | null = useMemo(() => {
    if (!profile) return null;
    return {
      uid: profile.uid,
      name: profile.displayName,
      role: profile.role as UserRole,
    };
  }, [profile]);

  useEffect(() => {
    void Promise.all([listEmployeesForLifecycle(), listDepartments()]).then(
      ([emps, depts]) => {
        setEmployees(emps);
        setDepartments(depts);
      }
    );
  }, []);

  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    if (emp.departmentId) setDepartmentId(emp.departmentId);
    if (!jobTitle && emp.designation) setJobTitle(emp.designation);
  }, [employeeId, employees, jobTitle]);

  async function handleAiDraft() {
    if (!jobTitle.trim()) {
      toast.error("Enter a job title first");
      return;
    }
    setBusy(true);
    try {
      const { draft, model } = await draftJdWithAi({
        jobTitle: jobTitle.trim(),
        department: departmentLabel(departments, departmentId) || undefined,
      });
      setResponsibilities(
        draft.responsibilities.map((r, i) => `${i + 1}. ${r}`).join("\n")
      );
      setQualifications(draft.qualifications.join("\n"));
      setSkills(draft.skills.join(", "));
      toast.success(`JD draft filled (${model}) — review before saving`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI draft failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!actor || !profile) return;
    if (!employeeId) {
      toast.error("Select an employee");
      return;
    }
    if (!jobTitle.trim()) {
      toast.error("Job title required");
      return;
    }
    const dept =
      departmentId ||
      employees.find((x) => x.id === employeeId)?.departmentId ||
      "";
    if (!dept) {
      toast.error("Department required — handover employee first");
      return;
    }

    setBusy(true);
    try {
      const jd = await createJobDescription(
        {
          employeeId,
          departmentId: dept,
          title: jobTitle.trim(),
          responsibilities: responsibilities
            .split("\n")
            .map((l) => l.replace(/^\d+\.\s*/, "").trim())
            .filter(Boolean),
          qualifications: qualifications
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          skills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          effectiveFrom: new Date(effectiveFrom).toISOString(),
        },
        profile.uid
      );
      await createJdLifecycle(employeeId, jd.id, actor);
      toast.success(`Job Description saved (${jd.id})`);
      setJobTitle("");
      setResponsibilities("");
      setQualifications("");
      setSkills("");
      setEmployeeId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save JD");
    } finally {
      setBusy(false);
    }
  }

  const eligible = employees.filter((e) =>
    ["department_handover", "jd_created", "induction_completed", "tni_created"].includes(
      e.lifecycleStage
    ) || !e.jdId
  );

  return (
    <RequirePermission permission={["jd:read", "jd:write"]}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Description</h1>
          <p className="text-muted-foreground">
            Department Head creates JD after handover
          </p>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>Create / update JD</CardTitle>
                <CardDescription>
                  Linked to employee after induction handover
                </CardDescription>
              </div>
              <Can permission="jd:write">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => void handleAiDraft()}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {busy ? "Drafting…" : "Draft with AI"}
                </Button>
              </Can>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void handleSave(e)}>
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {(eligible.length ? eligible : employees).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} · {e.employeeCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Job title</Label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsibilities (one per line)</Label>
                <Textarea
                  rows={5}
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Qualifications</Label>
                <Textarea
                  rows={3}
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Skills (comma separated)</Label>
                <Textarea
                  rows={2}
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Effective from</Label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>
              <Can permission="jd:write">
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save JD
                </Button>
              </Can>
            </form>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
