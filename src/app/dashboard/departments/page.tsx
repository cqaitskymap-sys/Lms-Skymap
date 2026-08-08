"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { RequirePermission } from "@/components/auth/require-permission";
import { useDepartments } from "@/hooks/use-departments";
import {
  createDepartmentSchema,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
} from "@/lib/auth/department-schemas";
import {
  createDepartment,
  deleteDepartment,
  seedPharmaDepartments,
  updateDepartment,
} from "@/lib/services/departments";
import type { Department } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

function DepartmentForm({
  defaultValues,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  defaultValues?: Partial<CreateDepartmentInput>;
  onSubmit: (data: CreateDepartmentInput) => Promise<void>;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateDepartmentInput>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      isActive: true,
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dept-code">Code</Label>
          <Input
            id="dept-code"
            placeholder="QA"
            className="uppercase"
            {...register("code")}
            disabled={Boolean(defaultValues?.code)}
          />
          {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="dept-name">Name</Label>
          <Input id="dept-name" placeholder="Quality Assurance" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dept-desc">Description</Label>
        <Textarea
          id="dept-desc"
          placeholder="Department responsibility…"
          rows={2}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export default function DepartmentsPage() {
  const { can } = useAuth();
  const { departments, loading, error, refresh } = useDepartments();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const canWrite = can("departments:write");
  const canDelete = can("departments:delete");

  const activeCount = useMemo(
    () => departments.filter((d) => d.isActive).length,
    [departments]
  );

  const handleCreate = async (data: CreateDepartmentInput) => {
    try {
      await createDepartment(data);
      setShowCreate(false);
      await refresh();
      toast.success(`Department ${data.code.toUpperCase()} created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create department");
    }
  };

  const handleEdit = async (data: CreateDepartmentInput) => {
    if (!editing) return;
    const patch: UpdateDepartmentInput = {
      name: data.name,
      description: data.description,
    };
    try {
      await updateDepartment(editing.id, patch);
      setEditing(null);
      await refresh();
      toast.success("Department updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleToggleActive = async (dept: Department) => {
    setBusyId(dept.id);
    try {
      await updateDepartment(dept.id, { isActive: !dept.isActive });
      await refresh();
      toast.success(dept.isActive ? "Department deactivated" : "Department activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await deleteDepartment(deleting.id);
      setDeleting(null);
      await refresh();
      toast.success(`Deleted ${deleting.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedPharmaDepartments();
      await refresh();
      toast.success(
        result.added > 0
          ? `Added ${result.added} standard pharma departments (${result.total} total)`
          : "All standard pharma departments already exist"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <RequirePermission permission="departments:read">
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Building2 className="h-7 w-7 text-primary" />
            Departments
          </h1>
          <p className="text-muted-foreground">
            Organizational units for employees, SOP ownership & training — {activeCount} active
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void handleSeed()} disabled={seeding}>
              {seeding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Load pharma departments
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add department
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All departments</CardTitle>
          <CardDescription>
            QA, QC, Production, Microbiology, Regulatory, Validation, Warehouse, and more
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-destructive">{error}</p>
              <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
                Retry
              </Button>
            </div>
          ) : departments.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No departments yet.</p>
              {canWrite && (
                <Button className="mt-4" variant="secondary" onClick={() => void handleSeed()}>
                  Load standard pharma departments
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <Badge variant="outline">{dept.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {dept.description || "—"}
                    </TableCell>
                    <TableCell>
                      {dept.isActive ? (
                        <Badge className="bg-emerald-600/90">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={busyId === dept.id}>
                              {busyId === dept.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(dept)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleToggleActive(dept)}>
                              {dept.isActive ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleting(dept)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add department</DialogTitle>
            <DialogDescription>Create a new organizational unit for your company.</DialogDescription>
          </DialogHeader>
          <DepartmentForm
            submitLabel="Create department"
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit department</DialogTitle>
            <DialogDescription>Code cannot be changed after creation.</DialogDescription>
          </DialogHeader>
          {editing && (
            <DepartmentForm
              defaultValues={{
                code: editing.code,
                name: editing.name,
                description: editing.description || "",
              }}
              submitLabel="Save changes"
              onSubmit={handleEdit}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete department?</DialogTitle>
            <DialogDescription>
              Remove <strong>{deleting?.name}</strong> ({deleting?.code})? This fails if
              employees, staff accounts, or SOPs still reference this department. Deactivate it
              instead when in doubt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busyId === deleting?.id} onClick={() => void handleDelete()}>
              {busyId === deleting?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RequirePermission>
  );
}
