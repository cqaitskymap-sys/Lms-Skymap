"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ROLE_DASHBOARD_ROUTES } from "@/lib/rbac/permissions";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DashboardPage() {
  const { role, profile, isDemo, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (role && role !== "super_admin") {
      const route = ROLE_DASHBOARD_ROUTES[role];
      if (route && route !== "/dashboard") router.replace(route);
    }
  }, [role, router, authLoading]);

  // Never mount the admin snapshot fetch for non-admins — it queries collections
  // employees cannot list and floods the console with permission-denied errors.
  if (authLoading || !role || role !== "super_admin") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <DashboardShell
      role="super_admin"
      title={`Welcome, ${profile?.displayName?.split(" ")[0] || "Admin"}`}
      subtitle={`Enterprise compliance command center${isDemo ? " · Demo data" : ""}`}
    >
      {({ view, loading }) => (
        <MotionItem>
          <GlassCard>
            <GlassCardHeader
              title="Training assignments snapshot"
              description="Latest SOP training status across the org"
            />
            <div className="overflow-x-auto">
              {loading && view.assignmentRows.length === 0 ? (
                <div className="flex items-center gap-2 py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>SOP</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.assignmentRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          No training assignments yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      view.assignmentRows.slice(0, 8).map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">{a.id}</TableCell>
                          <TableCell>{a.employee}</TableCell>
                          <TableCell>{a.sop}</TableCell>
                          <TableCell>
                            <StatusBadge status={a.status} />
                          </TableCell>
                          <TableCell>
                            {a.score != null ? `${a.score}%` : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </GlassCard>
        </MotionItem>
      )}
    </DashboardShell>
  );
}
