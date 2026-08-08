"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, FileText, Eye, PenLine, Loader2 } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataToolbar } from "@/components/shared/data-toolbar";
import { useSopDirectory } from "@/hooks/use-sop";
import { useDepartments } from "@/hooks/use-departments";
import { deleteSop } from "@/lib/services/sops";
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
import { formatDate } from "@/lib/utils";
import { SopLoading } from "@/components/sops/sop-media-preview";
import type { SopStatus } from "@/types";

export default function SopsPage() {
  const { sops, loading, error, refresh } = useSopDirectory();
  const { departments } = useDepartments();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    return sops.filter((s) => {
      const matchSearch =
        !search ||
        `${s.sopNumber} ${s.title} ${s.category} ${s.tags.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchStatus = !status || s.status === status;
      return matchSearch && matchStatus;
    });
  }, [sops, search, status]);

  const deptLabel = (ids: string[]) =>
    ids
      .map((id) => departments.find((d) => d.id === id)?.code || id)
      .join(", ");

  if (loading) return <SopLoading />;

  if (error) {
    return (
      <RequirePermission permission={["sops:read"]}>
        <div className="py-16 text-center">
          <p className="text-destructive">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission permission={["sops:read"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SOP Management</h1>
            <p className="text-muted-foreground">
              Controlled documents · versioning · acknowledgement · auto-retraining
            </p>
          </div>
          <RequirePermission permission="sops:write" hideOnDeny>
            <Button asChild>
              <Link href="/dashboard/sops/new">
                <Plus className="mr-2 h-4 w-4" />
                New SOP
              </Link>
            </Button>
          </RequirePermission>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total SOPs", value: sops.length, icon: FileText },
            {
              label: "Approved",
              value: sops.filter((s) => s.status === "approved").length,
              icon: FileText,
            },
            {
              label: "Under review",
              value: sops.filter((s) => s.status === "under_review").length,
              icon: Eye,
            },
            {
              label: "Acknowledgements",
              value: sops.reduce((n, s) => n + (s.acknowledgementCount || 0), 0),
              icon: PenLine,
            },
          ].map((c) => (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <c.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <DataToolbar
          searchPlaceholder="Search SOPs…"
          onSearch={(v) => {
            setSearch(v);
            void refresh({ search: v, status: status as SopStatus | "" });
          }}
          filters={[
            {
              key: "status",
              label: "Status",
              value: status,
              options: [
                { label: "Draft", value: "draft" },
                { label: "Under review", value: "under_review" },
                { label: "Approved", value: "approved" },
                { label: "Obsolete", value: "obsolete" },
              ],
            },
          ]}
          onFilterChange={(key, value) => {
            if (key === "status") setStatus(value);
          }}
          actions={
            <RequirePermission permission="sops:write" hideOnDeny>
              <Button size="sm" variant="outline" asChild>
                <Link href="/dashboard/sops/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New SOP
                </Link>
              </Button>
            </RequirePermission>
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
                  <TableHead>Version</TableHead>
                  <TableHead>Departments</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Views / Ack</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                      {sops.length === 0 ? (
                        <div className="space-y-2">
                          <p>No SOPs in the library yet.</p>
                          <RequirePermission permission="sops:write" hideOnDeny>
                            <Button size="sm" asChild>
                              <Link href="/dashboard/sops/new">Create first SOP</Link>
                            </Button>
                          </RequirePermission>
                        </div>
                      ) : (
                        "No SOPs match your filters."
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/sops/${s.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {s.sopNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.category}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      v{s.currentVersionNumber || s.version?.versionNumber || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{deptLabel(s.departmentIds)}</TableCell>
                    <TableCell>{formatDate(s.effectiveDate)}</TableCell>
                    <TableCell>{formatDate(s.reviewDate)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.viewCount || 0} / {s.acknowledgementCount || 0}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell>
                      <AdminDeleteButton
                        confirmTitle={`Delete ${s.sopNumber}?`}
                        confirmDescription="This SOP and its versions, views, and acknowledgements will be removed permanently."
                        successMessage="SOP deleted"
                        onDelete={async () => {
                          await deleteSop(s.id);
                          await refresh();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
