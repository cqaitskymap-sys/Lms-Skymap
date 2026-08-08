"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import { listStaffUsers } from "@/lib/services/users";
import { ensureTrainerProfilesFromUsers, listTrainers } from "@/lib/services/training";
import { listDepartments, departmentLabel } from "@/lib/services/departments";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Department, TrainerProfile, UserProfile } from "@/types";

export default function TrainersPage() {
  const { profile } = useAuth();
  const canReadUsers = profile?.role ? hasPermission(profile.role, "users:read") : false;
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [depts, existing] = await Promise.all([
          listDepartments(),
          listTrainers(),
        ]);
        setDepartments(depts);

        let profiles = existing;
        if (canReadUsers) {
          const staff = await listStaffUsers().catch(() => [] as UserProfile[]);
          setUsers(staff);
          if (staff.length > 0) {
            profiles = await ensureTrainerProfilesFromUsers(staff);
          }
        } else {
          setUsers([]);
        }
        setTrainers(profiles);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load trainers");
        setTrainers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [canReadUsers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trainers</h1>
          <p className="text-muted-foreground">Qualified trainers for SOP sessions</p>
        </div>
        {canReadUsers && (
          <Button asChild size="sm">
            <Link href="/dashboard/users">
              <UserPlus className="mr-1.5 h-4 w-4" /> Add trainer user
            </Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading trainers…
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : trainers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="font-medium">No trainer users yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {canReadUsers ? (
                <>
                  Create a new user in User Management and set the role to{" "}
                  <strong>Trainer</strong>. They will appear here automatically — you can select
                  them when assigning training.
                </>
              ) : (
                <>
                  Trainers are provisioned from user accounts with the Trainer role. Contact HR or
                  an administrator to add trainer users.
                </>
              )}
            </p>
            {canReadUsers && (
              <Button asChild className="mt-1">
                <Link href="/dashboard/users">
                  <UserPlus className="mr-1.5 h-4 w-4" /> Go to User Management
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {trainers.map((t) => {
            const u = users.find((x) => x.uid === t.userId);
            return (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle>{u?.displayName || t.userId}</CardTitle>
                  <CardDescription>{u?.email || "—"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {t.specializations.map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t.totalSessionsConducted} sessions conducted
                    {t.departmentIds[0]
                      ? ` · ${departmentLabel(departments, t.departmentIds[0])}`
                      : ""}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
