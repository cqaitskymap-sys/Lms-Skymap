"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  useInductionAssignments,
  useInductionCatalog,
  useMyInduction,
} from "@/hooks/use-induction";
import {
  assignInductionLifecycle,
  listEmployeesForLifecycle,
  type LifecycleActor,
} from "@/lib/services/lifecycle";
import {
  markDocumentViewed,
  markModuleStudied,
  deleteInductionAssignment,
  deleteInductionModule,
} from "@/lib/services/induction";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { AiExplainInline } from "@/components/ai/ai-explain-inline";
import { PdfViewer } from "@/components/shared/pdf-viewer";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Employee, UserRole } from "@/types";

export default function InductionPage() {
  const searchParams = useSearchParams();
  const assignFromUrl = searchParams.get("assign") || "";
  const { profile, can } = useAuth();
  const isHr = can("induction:assign") || can("induction:write");
  const employeeId = profile?.employeeId;

  const { items, loading: myLoading, error: myError, refresh: refreshMine, progress } =
    useMyInduction(employeeId);
  const { modules, loading: catLoading, error: catError, refresh: refreshCatalog } =
    useInductionCatalog();
  const { assignments, loading: asgLoading, error: asgError, refresh: refreshAsg } =
    useInductionAssignments({ enabled: isHr });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!isHr) return;
    setEmployeesLoading(true);
    try {
      setEmployees(await listEmployeesForLifecycle());
    } catch {
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  }, [isHr]);

  useEffect(() => {
    void loadEmployees();
    const onUpdate = () => void loadEmployees();
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => window.removeEventListener("pharma-lifecycle-updated", onUpdate);
  }, [loadEmployees]);

  useEffect(() => {
    if (assignFromUrl) setAssignEmployeeId(assignFromUrl);
  }, [assignFromUrl]);

  const assignableEmployees = useMemo(
    () =>
      employees.filter(
        (e) =>
          Boolean(e.verifiedAt) &&
          e.lifecycleStage !== "qualified" &&
          e.lifecycleStage !== "induction_completed"
      ),
    [employees]
  );

  const actor: LifecycleActor | null = useMemo(() => {
    if (!profile) return null;
    return {
      uid: profile.uid,
      name: profile.displayName,
      role: profile.role as UserRole,
    };
  }, [profile]);

  const handleMarkStudied = async (assignmentId: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      await markModuleStudied(assignmentId, profile.uid);
      toast.success("Marked as studied — ready for assessment");
      await refreshMine();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update progress");
    } finally {
      setBusy(false);
    }
  };

  const handleViewDoc = async (assignmentId: string, documentId: string) => {
    if (!profile) return;
    try {
      await markDocumentViewed(assignmentId, documentId, profile.uid);
      await refreshMine();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not track document view");
    }
  };

  const handleAssign = async () => {
    if (!actor || !assignEmployeeId || !selectedModules.length) {
      toast.error("Select an employee and at least one module");
      return;
    }
    setBusy(true);
    try {
      await assignInductionLifecycle(assignEmployeeId, selectedModules, actor);
      toast.success("Induction modules assigned");
      setSelectedModules([]);
      setAssignEmployeeId("");
      window.dispatchEvent(new Event("pharma-lifecycle-updated"));
      await Promise.all([refreshAsg(), refreshMine(), loadEmployees()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const defaultTab = assignFromUrl && isHr ? "assign" : employeeId ? "mine" : isHr ? "assign" : "catalog";

  return (
    <RequirePermission permission="induction:read">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Induction</h1>
          <p className="text-muted-foreground">
            Onboarding modules, documents & assessment readiness
          </p>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {employeeId && <TabsTrigger value="mine">My induction</TabsTrigger>}
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <Can permission="induction:assign">
              <TabsTrigger value="assign">Assign</TabsTrigger>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
            </Can>
          </TabsList>

          {employeeId && (
            <TabsContent value="mine" className="space-y-4">
              {myLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading assignments…
                </div>
              ) : myError ? (
                <Card>
                  <CardContent className="py-8 text-center text-destructive">{myError}</CardContent>
                </Card>
              ) : items.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <BookOpen className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">No induction modules assigned yet</p>
                    <p className="text-sm text-muted-foreground">
                      HR will assign your onboarding modules shortly.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Overall progress</CardTitle>
                      <CardDescription>
                        {items.filter((i) => i.assignment.status === "passed").length}/
                        {items.length} modules completed
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Progress value={progress} className="h-2" />
                      <p className="mt-2 text-sm text-muted-foreground">{progress}%</p>
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {items.map(({ assignment, module: m }) => (
                      <Card key={assignment.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base">{m.title}</CardTitle>
                              <CardDescription>{m.description}</CardDescription>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {m.isMandatory && <Badge>Mandatory</Badge>}
                              <StatusBadge status={assignment.status} />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              ~{m.estimatedMinutes} min
                            </span>
                            <span>Pass ≥ {m.passPercentage}%</span>
                          </div>
                          <Progress value={assignment.progressPercent} />
                          <p className="text-xs text-muted-foreground">
                            {assignment.progressPercent}% ·{" "}
                            {assignment.documentsViewed.length}/
                            {Math.max(m.documents.length, 0)} documents viewed
                          </p>

                          {m.documents.map((d) => (
                            <div key={d.id} className="space-y-2">
                              {d.type === "pdf" ? (
                                <div
                                  onFocus={() => void handleViewDoc(assignment.id, d.id)}
                                  onClick={() => void handleViewDoc(assignment.id, d.id)}
                                >
                                  <PdfViewer url={d.downloadUrl} title={d.title} />
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleViewDoc(assignment.id, d.id)}
                                >
                                  Open {d.title}
                                </Button>
                              )}
                            </div>
                          ))}

                          <AiExplainInline
                            kind="induction"
                            title={m.title}
                            description={m.description}
                            buttonLabel="Study help (AI)"
                          />

                          <div className="flex flex-wrap gap-2">
                            {assignment.status !== "passed" &&
                              assignment.status !== "assessment_pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void handleMarkStudied(assignment.id)}
                                >
                                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                  Mark studied
                                </Button>
                              )}
                            {(assignment.status === "assessment_pending" ||
                              assignment.status === "failed" ||
                              assignment.progressPercent >= 100) &&
                              assignment.status !== "passed" &&
                              m.assessmentId && (
                                <Button size="sm" asChild>
                                  <Link
                                    href={`/dashboard/exams?exam=${m.assessmentId}&inda=${assignment.id}`}
                                  >
                                    <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                                    Take assessment
                                  </Link>
                                </Button>
                              )}
                            {(assignment.status === "assessment_pending" ||
                              assignment.progressPercent >= 100) &&
                              assignment.status !== "passed" &&
                              !m.assessmentId && (
                                <p className="text-xs text-muted-foreground">
                                  No linked assessment — module marked complete when studied.
                                </p>
                              )}
                            {assignment.status === "passed" && (
                              <p className="text-sm font-medium text-emerald-600">
                                Passed{assignment.score != null ? ` · ${assignment.score}%` : ""}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          )}

          <TabsContent value="catalog" className="space-y-4">
            <Can permission="induction:write">
              <div className="flex justify-end">
                <Button asChild>
                  <Link href="/dashboard/induction/new">
                    <Plus className="mr-1.5 h-4 w-4" /> Create module
                  </Link>
                </Button>
              </div>
            </Can>
            {catLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog…
              </div>
            ) : catError ? (
              <Card>
                <CardContent className="py-8 text-center text-destructive">{catError}</CardContent>
              </Card>
            ) : modules.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">No induction modules yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create modules to build your onboarding catalog.
                  </p>
                  <Can permission="induction:write">
                    <Button asChild className="mt-1">
                      <Link href="/dashboard/induction/new">
                        <Plus className="mr-1.5 h-4 w-4" /> Create module
                      </Link>
                    </Button>
                  </Can>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {modules.map((m) => (
                  <Card key={m.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{m.title}</CardTitle>
                        <div className="flex items-center gap-1">
                          {m.isMandatory && <Badge>Mandatory</Badge>}
                          <AdminDeleteButton
                            confirmTitle={`Delete module “${m.title}”?`}
                            confirmDescription="This induction module and related assignments will be removed permanently."
                            successMessage="Module deleted"
                            onDelete={async () => {
                              await deleteInductionModule(m.id);
                              await refreshCatalog();
                              await refreshAsg();
                            }}
                          />
                        </div>
                      </div>
                      <CardDescription>{m.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      ~{m.estimatedMinutes} min · {m.documents.length} document(s) · Pass ≥{" "}
                      {m.passPercentage}%
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <Can permission="induction:assign">
            <TabsContent value="assign" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="h-4 w-4" /> Assign induction modules
                  </CardTitle>
                  <CardDescription>
                    Select an employee and the modules they must complete
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select
                      value={assignEmployeeId}
                      onValueChange={setAssignEmployeeId}
                      disabled={employeesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            employeesLoading ? "Loading employees…" : "Select employee"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableEmployees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.firstName} {e.lastName} · {e.employeeCode} (
                            {e.lifecycleStage?.replace(/_/g, " ")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!employeesLoading && assignableEmployees.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No verified employees ready for induction. Complete HR verification on
                        the employee profile first.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Modules</Label>
                    {modules.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                        <p>No modules in catalog yet.</p>
                        <Button asChild variant="link" className="mt-1 h-auto p-0">
                          <Link href="/dashboard/induction/new">Create a module first</Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-md border p-3">
                        {modules.map((m) => (
                          <label
                            key={m.id}
                            className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-accent/50"
                          >
                            <Checkbox
                              checked={selectedModules.includes(m.id)}
                              onCheckedChange={() => toggleModule(m.id)}
                            />
                            <div>
                              <p className="text-sm font-medium">{m.title}</p>
                              <p className="text-xs text-muted-foreground">{m.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button disabled={busy} onClick={() => void handleAssign()}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Assign & advance lifecycle
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tracking" className="space-y-4">
              {asgLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : asgError ? (
                <Card>
                  <CardContent className="py-8 text-center text-destructive">{asgError}</CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Assignment tracking</CardTitle>
                    <CardDescription>{assignments.length} assignment records</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {assignments.map((a) => {
                      const mod = modules.find((m) => m.id === a.moduleId);
                      const emp = employees.find((e) => e.id === a.employeeId);
                      return (
                        <div
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {emp
                                ? `${emp.firstName} ${emp.lastName}`
                                : a.employeeId}{" "}
                              · {mod?.title || a.moduleId}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {a.progressPercent}% complete
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={a.status} />
                            <AdminDeleteButton
                              confirmTitle="Delete assignment?"
                              confirmDescription="This induction assignment will be removed permanently."
                              successMessage="Assignment deleted"
                              onDelete={async () => {
                                await deleteInductionAssignment(a.id);
                                await refreshAsg();
                                await refreshMine();
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {!assignments.length && (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        <p>No induction assignments yet.</p>
                        <p className="mt-1">
                          Use the Assign tab to link modules to verified employees.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Can>
        </Tabs>
      </div>
    </RequirePermission>
  );
}
