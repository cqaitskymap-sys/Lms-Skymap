"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { DEMO_SOPS } from "@/lib/demo/data";
import { RequirePermission } from "@/components/auth/require-permission";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataToolbar } from "@/components/shared/data-toolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";

export default function SopsPage() {
  const [search, setSearch] = useState("");
  const filtered = DEMO_SOPS.filter(
    (s) =>
      !search ||
      `${s.sopNumber} ${s.title} ${s.category}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <RequirePermission permission={["sops:read"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SOP Management</h1>
          <p className="text-muted-foreground">Version-controlled standard operating procedures</p>
        </div>

        <DataToolbar
          searchPlaceholder="Search SOPs…"
          onSearch={setSearch}
          actions={
            <Button size="sm" asChild>
              <Link href="/dashboard/sops/new">
                <Plus className="mr-2 h-4 w-4" />
                New SOP
              </Link>
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{filtered.length} documents</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SOP No.</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
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
                    <TableCell className="text-xs text-muted-foreground">
                      {s.tags.join(", ")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
