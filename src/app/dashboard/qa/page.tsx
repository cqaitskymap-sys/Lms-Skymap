"use client";

import { FileText, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { DEMO_SOPS, DEMO_STATS } from "@/lib/demo/data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QA Dashboard</h1>
          <p className="text-muted-foreground">SOP management & compliance</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/sops/new">New SOP</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total SOPs" value={DEMO_SOPS.length} icon={FileText} />
        <StatCard title="Approved" value={DEMO_SOPS.filter((s) => s.status === "approved").length} icon={CheckCircle2} />
        <StatCard title="Under review" value={DEMO_SOPS.filter((s) => s.status === "under_review").length} icon={Clock} />
        <StatCard title="Revisions this month" value={DEMO_STATS.sopRevisionsThisMonth} icon={RefreshCw} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SOP register</CardTitle>
        </CardHeader>
        <CardContent>
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
                    <Link href={`/dashboard/sops/${s.id}`} className="font-medium text-primary hover:underline">
                      {s.sopNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{s.title}</TableCell>
                  <TableCell>{s.category}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
