"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { ROLE_DASHBOARD_ROUTES } from "@/lib/rbac/permissions";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DEMO_ASSIGNMENTS } from "@/lib/demo/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DashboardPage() {
  const { role, profile, isDemo } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role && role !== "super_admin") {
      const route = ROLE_DASHBOARD_ROUTES[role];
      if (route && route !== "/dashboard") router.replace(route);
    }
  }, [role, router]);

  return (
    <DashboardShell
      role="super_admin"
      title={`Welcome, ${profile?.displayName?.split(" ")[0] || "Admin"}`}
      subtitle={`Enterprise compliance command center${isDemo ? " · Demo data" : ""}`}
    >
      <MotionItem>
        <GlassCard>
          <GlassCardHeader
            title="Training assignments snapshot"
            description="Latest SOP training status across the org"
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_ASSIGNMENTS.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <Link
                        href="/dashboard/training"
                        className="text-primary hover:underline"
                      >
                        {a.id}
                      </Link>
                    </TableCell>
                    <TableCell>{a.employeeId}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>{a.score != null ? `${a.score}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      </MotionItem>
    </DashboardShell>
  );
}
