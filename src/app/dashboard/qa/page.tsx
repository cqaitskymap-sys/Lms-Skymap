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

export default function QaDashboardPage() {
  return (
    <DashboardShell
      role="qa"
      title="QA Dashboard"
      subtitle="SOP governance, revisions & compliance oversight"
    >
      <MotionItem>
        <GlassCard>
          <GlassCardHeader
            title="SOP register"
            description="Controlled documents"
            action={
              <Button size="sm" asChild>
                <Link href="/dashboard/sops/new">New SOP</Link>
              </Button>
            }
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No SOPs yet. Create one to get started.
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
