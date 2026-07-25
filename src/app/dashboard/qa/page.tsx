"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DEMO_SOPS } from "@/lib/demo/data";
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
                {DEMO_SOPS.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/sops/${s.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {s.sopNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{s.title}</TableCell>
                    <TableCell>{s.category}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
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
