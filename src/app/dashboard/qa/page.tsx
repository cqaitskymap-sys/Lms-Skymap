"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { listSopsDetailed } from "@/lib/services/sops";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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
import type { SopDocument } from "@/types";

export default function QaDashboardPage() {
  const [sops, setSops] = useState<SopDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSops(await listSopsDetailed());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-sops-updated", onUpdate);
    return () => window.removeEventListener("pharma-sops-updated", onUpdate);
  }, [refresh]);

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
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading SOPs…
              </div>
            ) : (
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
                  {sops.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No SOPs yet. Create one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sops.slice(0, 10).map((s) => (
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
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </GlassCard>
      </MotionItem>
    </DashboardShell>
  );
}
