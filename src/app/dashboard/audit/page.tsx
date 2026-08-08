"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RequirePermission, Can } from "@/components/auth/require-permission";
import { DataToolbar } from "@/components/shared/data-toolbar";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import {
  AUDIT_UPDATED_EVENT,
  exportAuditLogsCsv,
  listAuditLogs,
  recordAuditEvent,
} from "@/lib/services/audit-logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AuditAction, AuditLog } from "@/types";

const ACTION_OPTIONS: Array<AuditAction | "all"> = [
  "all",
  "create",
  "update",
  "delete",
  "assign",
  "approve",
  "reject",
  "submit",
  "login",
  "logout",
  "export",
  "sign",
  "reassign",
];

function inDateRange(iso: string, dateFrom?: string, dateTo?: string): boolean {
  if (!dateFrom && !dateTo) return true;
  const t = new Date(iso).getTime();
  if (dateFrom && t < new Date(dateFrom).getTime()) return false;
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    if (t > to.getTime()) return false;
  }
  return true;
}

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("all");
  const [resourceType, setResourceType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAllLogs(await listAuditLogs(500));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit trail");
      setAllLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    window.addEventListener("pharma-sops-updated", onUpdate);
    window.addEventListener(AUDIT_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
      window.removeEventListener("pharma-sops-updated", onUpdate);
      window.removeEventListener(AUDIT_UPDATED_EVENT, onUpdate);
    };
  }, [refresh]);

  const resourceOptions = useMemo(() => {
    const set = new Set(allLogs.map((l) => l.resourceType).filter(Boolean));
    return ["all", ...[...set].sort()];
  }, [allLogs]);

  const logs = useMemo(() => {
    return allLogs.filter((a) => {
      if (action !== "all" && a.action !== action) return false;
      if (resourceType !== "all" && a.resourceType !== resourceType) return false;
      if (!inDateRange(a.timestamp, dateFrom || undefined, dateTo || undefined)) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const blob = `${a.description} ${a.actorEmail} ${a.actorRole} ${a.action} ${a.resourceType} ${a.resourceId}`;
        if (!blob.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allLogs, action, resourceType, dateFrom, dateTo, search]);

  const todayCount = useMemo(() => {
    const day = new Date().toISOString().slice(0, 10);
    return logs.filter((l) => l.timestamp.startsWith(day)).length;
  }, [logs]);

  const actorCount = useMemo(
    () => new Set(logs.map((l) => l.actorEmail)).size,
    [logs]
  );

  const handleExport = async () => {
    try {
      exportAuditLogsCsv(logs);
      await recordAuditEvent({
        action: "export",
        resourceType: "audit_logs",
        resourceId: "trail",
        description: `Exported ${logs.length} audit log row(s) as CSV`,
        after: { rowCount: logs.length },
      });
      toast.success(`Exported ${logs.length} rows`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };

  return (
    <RequirePermission permission="audit:read">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
            <p className="text-muted-foreground">
              Append-only activity log for compliance (server-written)
            </p>
          </div>
          <Can permission="audit:read">
            <Button
              variant="outline"
              size="sm"
              disabled={!logs.length || loading}
              onClick={() => void handleExport()}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </Can>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <p className="text-2xl font-bold tracking-tight">{logs.length}</p>
              <p className="text-sm text-muted-foreground">Entries (filtered)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-2xl font-bold tracking-tight">{todayCount}</p>
              <p className="text-sm text-muted-foreground">Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-2xl font-bold tracking-tight">{actorCount}</p>
              <p className="text-sm text-muted-foreground">Unique actors</p>
            </CardContent>
          </Card>
        </div>

        <DataToolbar searchPlaceholder="Search audit logs…" onSearch={setSearch} />

        <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a === "all" ? "All actions" : a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Resource</Label>
            <Select value={resourceType} onValueChange={setResourceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resourceOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r === "all" ? "All resources" : r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="space-y-3 py-10 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Log entries</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No audit entries match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDateTime(a.timestamp)}
                          </TableCell>
                          <TableCell className="text-xs">{a.actorEmail}</TableCell>
                          <TableCell className="text-xs">{a.actorRole || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{a.action}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-xs">
                            {a.resourceType}/{a.resourceId}
                          </TableCell>
                          <TableCell className="max-w-[280px] text-sm">{a.description}</TableCell>
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
                <ActivityTimeline items={logs.slice(0, 40)} maxHeight="520px" />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
