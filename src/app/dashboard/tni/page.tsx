"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { draftTniWithAi } from "@/lib/services/ai";
import { createTNI, listJobDescriptions } from "@/lib/services/training";
import {
  createTniLifecycle,
  listEmployeesForLifecycle,
  type LifecycleActor,
} from "@/lib/services/lifecycle";
import { listSopsDetailed } from "@/lib/services/sops";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import type {
  Employee,
  JobDescription,
  SopDocument,
  TrainingNeedItem,
  UserRole,
} from "@/types";

interface NeedRow {
  id: string;
  topic: string;
  sopId: string;
  priority: TrainingNeedItem["priority"];
  rationale: string;
}

export default function TniPage() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [sops, setSops] = useState<SopDocument[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [jdId, setJdId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [needs, setNeeds] = useState<NeedRow[]>([]);
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
    void Promise.all([
      listEmployeesForLifecycle(),
      listJobDescriptions(),
      listSopsDetailed({ status: "approved" }),
    ]).then(([emps, jdList, sopList]) => {
      setEmployees(emps);
      setJds(jdList);
      setSops(sopList);
    });
  }, []);

  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const linked = jds.find((j) => j.id === emp.jdId) || jds.find((j) => j.employeeId === emp.id);
    if (linked) {
      setJdId(linked.id);
      setJobTitle(linked.title);
      setResponsibilities(linked.responsibilities.join("\n"));
    } else if (emp.designation) {
      setJobTitle(emp.designation);
    }
  }, [employeeId, employees, jds]);

  const addNeed = () =>
    setNeeds((n) => [
      ...n,
      {
        id: crypto.randomUUID(),
        topic: "",
        sopId: "",
        priority: "medium",
        rationale: "",
      },
    ]);

  async function handleAiSuggest() {
    if (!jobTitle.trim() || responsibilities.trim().length < 10) {
      toast.error("Enter job title and responsibilities first");
      return;
    }
    setBusy(true);
    try {
      const { needs: drafted, model } = await draftTniWithAi({
        jobTitle: jobTitle.trim(),
        responsibilities: responsibilities.trim(),
      });
      setNeeds(
        drafted.map((n) => ({
          id: crypto.randomUUID(),
          topic: n.topic,
          sopId: "",
          priority: n.priority as NeedRow["priority"],
          rationale: n.rationale,
        }))
      );
      toast.success(`Suggested ${drafted.length} training needs (${model})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI suggest failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!actor || !profile) return;
    if (!employeeId) {
      toast.error("Select an employee");
      return;
    }
    if (!jdId) {
      toast.error("Create and link a Job Description first");
      return;
    }
    if (!needs.length || needs.some((n) => !n.topic.trim())) {
      toast.error("Add at least one training need with a topic");
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    const dept = emp?.departmentId || jds.find((j) => j.id === jdId)?.departmentId;
    if (!dept) {
      toast.error("Employee department missing");
      return;
    }

    setBusy(true);
    try {
      const tni = await createTNI(
        {
          employeeId,
          departmentId: dept,
          jdId,
          needs: needs.map((n) => ({
            id: n.id,
            topic: n.topic.trim(),
            sopId: n.sopId || undefined,
            priority: n.priority,
            rationale: n.rationale.trim(),
            status: "identified" as const,
          })),
        },
        profile.uid
      );
      await createTniLifecycle(employeeId, tni.id, actor);
      toast.success(`TNI submitted (${tni.id})`);
      setNeeds([]);
      setEmployeeId("");
      setJdId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit TNI");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequirePermission permission={["tni:read", "tni:write"]}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Training Need Identification
          </h1>
          <p className="text-muted-foreground">
            Map JD responsibilities to SOP training needs
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>TNI form</CardTitle>
                <CardDescription>
                  Created by Department Head after JD approval
                </CardDescription>
              </div>
              <Can permission="tni:write">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => void handleAiSuggest()}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {busy ? "Suggesting…" : "Suggest with AI"}
                </Button>
              </Can>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} · {e.employeeCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Linked JD</Label>
                <Select value={jdId} onValueChange={setJdId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select JD" />
                  </SelectTrigger>
                  <SelectContent>
                    {jds
                      .filter((j) => !employeeId || j.employeeId === employeeId)
                      .map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title} ({j.id})
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
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>JD responsibilities (for AI)</Label>
                <Textarea
                  rows={3}
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                />
              </div>
            </div>

            {needs.map((need, idx) => (
              <div key={need.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Need #{idx + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setNeeds((n) => n.filter((x) => x.id !== need.id))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Topic</Label>
                    <Input
                      value={need.topic}
                      onChange={(e) =>
                        setNeeds((n) =>
                          n.map((x) =>
                            x.id === need.id
                              ? { ...x, topic: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Related SOP</Label>
                    <Select
                      value={need.sopId || "__none"}
                      onValueChange={(v) =>
                        setNeeds((n) =>
                          n.map((x) =>
                            x.id === need.id
                              ? { ...x, sopId: v === "__none" ? "" : v }
                              : x
                          )
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select SOP" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">No SOP linked</SelectItem>
                        {sops.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.sopNumber} — {s.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={need.priority}
                      onValueChange={(v) =>
                        setNeeds((n) =>
                          n.map((x) =>
                            x.id === need.id
                              ? {
                                  ...x,
                                  priority: v as NeedRow["priority"],
                                }
                              : x
                          )
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Rationale</Label>
                    <Textarea
                      rows={2}
                      value={need.rationale}
                      onChange={(e) =>
                        setNeeds((n) =>
                          n.map((x) =>
                            x.id === need.id
                              ? { ...x, rationale: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={addNeed}>
                <Plus className="mr-2 h-4 w-4" />
                Add need
              </Button>
              <Can permission="tni:write">
                <Button disabled={busy} onClick={() => void handleSubmit()}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit TNI
                </Button>
              </Can>
            </div>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
