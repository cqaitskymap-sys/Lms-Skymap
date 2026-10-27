"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useLifecycleDirectory } from "@/hooks/use-employee-lifecycle";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LifecycleDashboardCards } from "@/components/lifecycle/lifecycle-dashboard-cards";
import { LifecycleApprovals } from "@/components/lifecycle/lifecycle-approvals";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/types";

export default function HrDashboardPage() {
  const { profile } = useAuth();
  const { employees, approvals, loading, error, refresh } = useLifecycleDirectory({
    includeApprovals: true,
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
        <p className="font-medium text-destructive">Could not load the HR dashboard</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <DashboardShell
      role="hr"
      title="HR Dashboard"
      subtitle="Onboarding, induction & workforce lifecycle"
    >
      <MotionItem>
        <LifecycleDashboardCards employees={employees} />
      </MotionItem>

      <div className="grid gap-4 lg:grid-cols-2">
        <MotionItem>
          <GlassCard className="h-full">
            <GlassCardHeader
              title="Pending approvals"
              description="Verification & handover gates"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/dashboard/employees/new/legacy">Bulk entry</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/dashboard/employees/new">Onboard employee</Link>
                  </Button>
                </div>
              }
            />
            {profile && (
              <LifecycleApprovals
                approvals={approvals}
                actor={{
                  uid: profile.uid,
                  name: profile.displayName,
                  role: profile.role as UserRole,
                  email: profile.email,
                }}
                onUpdated={() => void refresh()}
              />
            )}
          </GlassCard>
        </MotionItem>

        <MotionItem>
          <GlassCard className="h-full">
            <GlassCardHeader title="Recent employees" description="Lifecycle progress" />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>DOJ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No employees yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/employees/${e.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {e.employeeCode}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {e.firstName} {e.lastName}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={e.lifecycleStage || e.status} />
                      </TableCell>
                      <TableCell>{formatDate(e.dateOfJoining)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </MotionItem>
      </div>
    </DashboardShell>
  );
}
