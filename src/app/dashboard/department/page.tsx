"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DeptDashboardPage() {
  return (
    <DashboardShell
      role="department_head"
      title="Department Dashboard"
      subtitle="JD, TNI, team training & compliance"
    >
      <MotionItem>
        <GlassCard>
          <GlassCardHeader
            title="Department training status"
            description="Team training assignments"
            action={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/jd">JDs</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/dashboard/training">Assign</Link>
                </Button>
              </div>
            }
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>SOP</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No department training data yet.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      </MotionItem>
    </DashboardShell>
  );
}
