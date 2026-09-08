"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Building2, FileUp, Handshake, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useDepartments } from "@/hooks/use-departments";
import {
  handoverAfterSignedInduction,
  listEmployeesForLifecycle,
  type LifecycleActor,
} from "@/lib/services/lifecycle";
import {
  deleteSignedInductionPaper,
  uploadSignedInductionPaper,
} from "@/lib/services/induction";
import { RequirePermission } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { formatBytes, formatDate } from "@/lib/utils";

import type { Employee, UserRole } from "@/types";

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function InductionPage() {
  const searchParams = useSearchParams();
  const assignFromUrl = searchParams.get("assign") || "";
  const { profile, can } = useAuth();
  const isHr = can("induction:assign") || can("induction:write");
  const { activeDepartments, loading: deptLoading } = useDepartments();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [handoverDept, setHandoverDept] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const paperInputRef = useRef<HTMLInputElement>(null);

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
    if (!assignFromUrl) return;
    const emp = employees.find((e) => e.id === assignFromUrl);
    setSelectedEmployeeId(assignFromUrl);
    if (emp?.departmentId) setHandoverDept(emp.departmentId);
  }, [assignFromUrl, employees]);

  const actor: LifecycleActor | null = useMemo(() => {
    if (!profile) return null;
    return {
      uid: profile.uid,
      name: profile.displayName,
      role: profile.role as UserRole,
    };
  }, [profile]);

  const inductionQueue = useMemo(
    () =>
      employees.filter(
        (e) =>
          Boolean(e.verifiedAt) &&
          e.lifecycleStage !== "qualified" &&
          !e.handedOverAt &&
          ["hr_verification", "induction_assigned", "induction_completed"].includes(
            e.lifecycleStage
          )
      ),
    [employees]
  );

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const hasSignedPdf = Boolean(selectedEmployee?.inductionSignedPaper?.downloadUrl);
  const alreadyHandedOver = Boolean(selectedEmployee?.handedOverAt);
  const deptForHandover = handoverDept || selectedEmployee?.departmentId || "";

  const handlePdfSelected = async (file: File | undefined) => {
    if (!file || !actor || !selectedEmployeeId) return;
    if (!isPdfFile(file)) {
      toast.error("Only the signed induction PDF can be uploaded");
      return;
    }
    setUploading(true);
    try {
      await uploadSignedInductionPaper({
        employeeId: selectedEmployeeId,
        file,
        actorId: actor.uid,
        actorName: actor.name,
      });
      toast.success("Signed induction PDF uploaded");
      window.dispatchEvent(new Event("pharma-lifecycle-updated"));
      await loadEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (paperInputRef.current) paperInputRef.current.value = "";
    }
  };

  const handleHandover = async () => {
    if (!actor || !selectedEmployeeId) {
      toast.error("Select an employee first");
      return;
    }
    if (!hasSignedPdf) {
      toast.error("Upload the signed induction PDF first");
      return;
    }
    if (!deptForHandover) {
      toast.error("Select a department for handover");
      return;
    }
    setBusy(true);
    try {
      await handoverAfterSignedInduction(selectedEmployeeId, deptForHandover, actor);
      toast.success("Employee handed over to department");
      setSelectedEmployeeId("");
      setHandoverDept("");
      window.dispatchEvent(new Event("pharma-lifecycle-updated"));
      await loadEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Handover failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePdf = async () => {
    if (!actor || !selectedEmployeeId) return;
    setBusy(true);
    try {
      await deleteSignedInductionPaper({
        employeeId: selectedEmployeeId,
        actorId: actor.uid,
      });
      toast.success("Signed induction PDF deleted");
      setConfirmDelete(false);
      window.dispatchEvent(new Event("pharma-lifecycle-updated"));
      await loadEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequirePermission permission="induction:read">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Induction</h1>
          <p className="text-muted-foreground">
            Upload the signed induction PDF, then hand the employee over to their department
          </p>
        </div>

        {isHr ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileUp className="h-4 w-4" /> Signed induction PDF
                </CardTitle>
                <CardDescription>
                  Upload only the signed induction PDF. After upload, hand over to the department.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={selectedEmployeeId}
                    onValueChange={(id) => {
                      setSelectedEmployeeId(id);
                      const emp = employees.find((e) => e.id === id);
                      if (emp?.departmentId) setHandoverDept(emp.departmentId);
                    }}
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
                      {inductionQueue.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.firstName} {e.lastName} · {e.employeeCode} (
                          {e.lifecycleStage?.replace(/_/g, " ")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!employeesLoading && inductionQueue.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No verified employees waiting for induction. Complete HR verification first.
                    </p>
                  )}
                </div>

                <input
                  ref={paperInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={!selectedEmployeeId || uploading || busy}
                  onChange={(e) => void handlePdfSelected(e.target.files?.[0])}
                />

                {selectedEmployee?.inductionSignedPaper?.downloadUrl ? (
                  <div className="space-y-3 rounded-md border px-3 py-3">
                    <p className="text-sm font-medium">Uploaded PDF</p>
                    <a
                      href={selectedEmployee.inductionSignedPaper.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {selectedEmployee.inductionSignedPaper.fileName}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(selectedEmployee.inductionSignedPaper.fileSize)} ·{" "}
                      {formatDate(selectedEmployee.inductionSignedPaper.uploadedAt)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading || busy}
                        onClick={() => paperInputRef.current?.click()}
                      >
                        Replace PDF
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading || busy || alreadyHandedOver}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!selectedEmployeeId || uploading}
                    onClick={() => paperInputRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <FileUp className="h-8 w-8 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium">Upload signed induction PDF</p>
                    <p className="text-xs text-muted-foreground">PDF only · max 15 MB</p>
                  </button>
                )}

                <Dialog open={confirmDelete} onOpenChange={(open) => !busy && setConfirmDelete(open)}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete signed induction PDF?</DialogTitle>
                      <DialogDescription>
                        This removes the uploaded file for{" "}
                        {selectedEmployee
                          ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                          : "this employee"}
                        . You can upload a new PDF afterwards.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void handleDeletePdf()}
                      >
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete PDF
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="space-y-3 border-t pt-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Handshake className="h-4 w-4" /> Department handover
                  </p>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={deptForHandover}
                      onValueChange={setHandoverDept}
                      disabled={!selectedEmployeeId || deptLoading || alreadyHandedOver}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={deptLoading ? "Loading departments…" : "Select department"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {activeDepartments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    disabled={
                      busy || uploading || !hasSignedPdf || !deptForHandover || alreadyHandedOver
                    }
                    onClick={() => void handleHandover()}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Building2 className="mr-2 h-4 w-4" />
                    )}
                    {alreadyHandedOver ? "Already handed over" : "Hand over to department"}
                  </Button>
                  {!hasSignedPdf && selectedEmployeeId && (
                    <p className="text-xs text-muted-foreground">
                      Upload the signed PDF to enable department handover.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Induction queue</CardTitle>
                <CardDescription>
                  Verified employees awaiting signed PDF or handover
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {employeesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : inductionQueue.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Queue is empty.
                  </p>
                ) : (
                  inductionQueue.map((e) => {
                    const paperReady = Boolean(e.inductionSignedPaper?.downloadUrl);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeId(e.id);
                          if (e.departmentId) setHandoverDept(e.departmentId);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition hover:bg-accent/50 ${
                          selectedEmployeeId === e.id ? "border-primary bg-accent/40" : ""
                        }`}
                      >
                        <div>
                          <p className="font-medium">
                            {e.firstName} {e.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{e.employeeCode}</p>
                        </div>
                        <Badge variant={paperReady ? "default" : "secondary"}>
                          {paperReady ? "PDF uploaded" : "Awaiting PDF"}
                        </Badge>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              HR uploads your signed induction PDF and hands you over to your department.
            </CardContent>
          </Card>
        )}
      </div>
    </RequirePermission>
  );
}
