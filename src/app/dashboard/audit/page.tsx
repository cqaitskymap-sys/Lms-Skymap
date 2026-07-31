"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { DataToolbar } from "@/components/shared/data-toolbar";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { listAuditLogs } from "@/lib/services/audit-logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AuditLog } from "@/types";

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setLogs(await listAuditLogs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    window.addEventListener("pharma-sops-updated", onUpdate);
    return () => {
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
      window.removeEventListener("pharma-sops-updated", onUpdate);
    };
  }, [refresh]);

  const filtered = logs.filter(
    (a) =>
      !search ||
      `${a.description} ${a.actorEmail} ${a.action} ${a.resourceType}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <RequirePermission permission="audit:read">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground">Immutable activity log for compliance</p>
        </div>

        <DataToolbar searchPlaceholder="Search audit logs…" onSearch={setSearch} />

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Log entries</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No audit entries yet. Lifecycle and SOP actions will appear here.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDateTime(a.timestamp)}
                          </TableCell>
                          <TableCell className="text-xs">{a.actorEmail}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{a.action}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {a.resourceType}/{a.resourceId}
                          </TableCell>
                          <TableCell>{a.description}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline items={filtered} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
