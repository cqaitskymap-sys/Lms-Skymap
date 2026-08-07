"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserX,
} from "lucide-react";
import { RequireRole } from "@/components/auth/require-permission";
import { StaffCredentialsCard } from "@/components/auth/staff-credentials-card";
import { StaffUserEditDialog } from "@/components/auth/staff-user-edit-dialog";
import { ModuleAccessPicker } from "@/components/auth/module-access-picker";
import { useAuth } from "@/contexts/auth-context";
import { DEMO_USERS } from "@/lib/demo/data";
import { useDepartments } from "@/hooks/use-departments";
import {
  createAdminUserSchema,
  PROVISIONABLE_ROLES,
  type CreateAdminUserInput,
  type UpdateAdminUserInput,
} from "@/lib/auth/user-admin-schemas";
import {
  defaultAllowedModules,
  moduleTitle,
  type AppModule,
} from "@/lib/rbac/modules";
import {
  createStaffUser,
  deleteStaffUser,
  listStaffUsers,
  resetStaffPassword,
  updateStaffUser,
  type CreateStaffUserResult,
  type StaffCredentials,
} from "@/lib/services/users";
import { ROLE_LABELS } from "@/lib/rbac/permissions";
import type { UserProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

const ROLE_LABELS_PROVISION: Record<(typeof PROVISIONABLE_ROLES)[number], string> = {
  hr: "HR",
  qa: "QA",
  department_head: "Department Head",
  trainer: "Trainer",
};

function isBuiltInDemoUser(user: UserProfile): boolean {
  return Object.values(DEMO_USERS).some((entry) => entry.profile.uid === user.uid);
}

function canManageUser(user: UserProfile, isDemo: boolean): boolean {
  if (user.role === "super_admin") return false;
  if (isDemo && isBuiltInDemoUser(user)) return false;
  return true;
}

export default function UserManagementPage() {
  const { profile, isDemo } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<CreateStaffUserResult | null>(null);
  const [resetCredentials, setResetCredentials] = useState<{
    credentials: StaffCredentials;
    displayName: string;
  } | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAdminUserInput>({
    resolver: zodResolver(createAdminUserSchema),
    defaultValues: {
      displayName: "",
      username: "",
      email: "",
      phone: "",
      role: "hr",
      departmentId: "",
      allowedModules: defaultAllowedModules("hr"),
    },
  });

  const role = watch("role");
  const departmentId = watch("departmentId");
  const allowedModules = watch("allowedModules");

  useEffect(() => {
    setValue("allowedModules", defaultAllowedModules(role), { shouldValidate: true });
  }, [role, setValue]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listStaffUsers();
      setUsers(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const { activeDepartments } = useDepartments();

  const onSubmit = async (data: CreateAdminUserInput) => {
    try {
      const result = await createStaffUser(data);
      setCreated(result);
      reset({
        displayName: "",
        username: "",
        email: "",
        phone: "",
        role: "hr",
        departmentId: "",
        allowedModules: defaultAllowedModules("hr"),
      });
      await loadUsers();
      toast.success(`Created ${ROLE_LABELS[data.role]} account for ${data.displayName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const handleEditSave = async (userId: string, data: UpdateAdminUserInput) => {
    try {
      await updateStaffUser(userId, data);
      await loadUsers();
      toast.success("User updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
      throw err;
    }
  };

  const toggleActive = async (user: UserProfile) => {
    if (user.uid === profile?.uid) {
      toast.error("You cannot deactivate your own account");
      return;
    }

    setActionUserId(user.uid);
    try {
      await updateStaffUser(user.uid, { isActive: !user.isActive });
      await loadUsers();
      toast.success(user.isActive !== false ? "Account deactivated" : "Account activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setActionUserId(null);
    }
  };

  const handleResetPassword = async (user: UserProfile) => {
    setActionUserId(user.uid);
    try {
      const credentials = await resetStaffPassword(user.uid);
      setResetCredentials({ credentials, displayName: user.displayName });
      toast.success("Password reset — share the new temporary password securely");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setActionUserId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setActionUserId(deletingUser.uid);
    try {
      await deleteStaffUser(deletingUser.uid);
      setDeletingUser(null);
      await loadUsers();
      toast.success(`Deleted ${deletingUser.displayName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <RequireRole roles="super_admin">
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="h-7 w-7 text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground">
            Create and manage HR, QA, Department Head, and Trainer accounts
            {isDemo ? " (demo mode)" : ""}
          </p>
        </div>

        {created && (
          <StaffCredentialsCard
            credentials={created.credentials}
            displayName={created.user.displayName}
            onDone={() => setCreated(null)}
          />
        )}

        {resetCredentials && (
          <StaffCredentialsCard
            credentials={resetCredentials.credentials}
            displayName={resetCredentials.displayName}
            onDone={() => setResetCredentials(null)}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" />
              Create staff account
            </CardTitle>
            <CardDescription>
              Login credentials are the staff ID and a one-time temporary password. Choose which
              modules this account can open. Work email is optional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2" noValidate>
              <div className="space-y-2">
                <Label htmlFor="displayName">Full name</Label>
                <Input id="displayName" placeholder="Priya Sharma" {...register("displayName")} />
                {errors.displayName && (
                  <p className="text-xs text-destructive">{errors.displayName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Staff ID</Label>
                <Input
                  id="username"
                  placeholder="e.g. HR1001"
                  autoComplete="off"
                  className="uppercase"
                  {...register("username")}
                />
                {errors.username && (
                  <p className="text-xs text-destructive">{errors.username.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Used as the login username (with the temporary password).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Work email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="hr@company.com"
                  autoComplete="off"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" placeholder="+91 …" {...register("phone")} />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) =>
                    setValue("role", v as CreateAdminUserInput["role"], { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVISIONABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS_PROVISION[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-xs text-destructive">{errors.role.message}</p>
                )}
              </div>

              {(role === "department_head" || role === "trainer") && (
                <div className="space-y-2 md:col-span-2">
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

              <div className="md:col-span-2">
                <ModuleAccessPicker
                  role={role}
                  value={(allowedModules ?? []) as AppModule[]}
                  onChange={(modules) =>
                    setValue("allowedModules", modules, { shouldValidate: true })
                  }
                  error={errors.allowedModules?.message}
                  disabled={isSubmitting}
                />
              </div>

              <div className="md:col-span-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff accounts</CardTitle>
            <CardDescription>
              Edit role, module access, department, status, reset password, or remove accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No staff accounts yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Staff ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Modules</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const manageable = canManageUser(user, isDemo);
                    const busy = actionUserId === user.uid;

                    return (
                      <TableRow key={user.uid}>
                        <TableCell className="font-medium">{user.displayName}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {user.username || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          {user.role === "super_admin" || !user.allowedModules ? (
                            <span className="text-xs text-muted-foreground">All (role)</span>
                          ) : (
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {user.allowedModules
                                .filter(
                                  (m) =>
                                    m !== "dashboard" &&
                                    m !== "settings" &&
                                    m !== "notifications"
                                )
                                .map((m) => moduleTitle(m as AppModule))
                                .join(", ") || "Core only"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {activeDepartments.find((d) => d.id === user.departmentId)?.name || "—"}
                        </TableCell>
                        <TableCell>
                          {user.isActive !== false ? (
                            <Badge className="bg-emerald-600/90">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(user.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {manageable ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={busy}>
                                  {busy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">Manage user</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingUser(user)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit profile
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void handleResetPassword(user)}
                                  disabled={user.isActive === false}
                                >
                                  <KeyRound className="mr-2 h-4 w-4" />
                                  Reset password
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void toggleActive(user)}
                                  disabled={user.uid === profile?.uid}
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  {user.isActive !== false ? "Deactivate" : "Activate"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeletingUser(user)}
                                  disabled={user.uid === profile?.uid}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete account
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <StaffUserEditDialog
          user={editingUser}
          open={Boolean(editingUser)}
          onOpenChange={(open) => !open && setEditingUser(null)}
          onSave={handleEditSave}
        />

        <Dialog open={Boolean(deletingUser)} onOpenChange={(open) => !open && setDeletingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete staff account?</DialogTitle>
              <DialogDescription>
                This permanently removes{" "}
                <strong>{deletingUser?.displayName}</strong> ({deletingUser?.email}) from Firebase
                Auth and Firestore. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingUser(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={actionUserId === deletingUser?.uid}
                onClick={() => void handleDelete()}
              >
                {actionUserId === deletingUser?.uid && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequireRole>
  );
}
