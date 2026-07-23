"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DEMO_EMPLOYEES, DEMO_SOPS } from "@/lib/demo/data";
import { RequirePermission } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { DEMO_ASSIGNMENTS } from "@/lib/demo/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function TrainingPage() {
  const [sopId, setSopId] = useState("");
  const [trainerId, setTrainerId] = useState("user_trainer");
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training</h1>
        <p className="text-muted-foreground">Assign SOP training, schedule sessions, track progress</p>
      </div>

      <RequirePermission permission="training:write" fallback={null}>
        <Card>
          <CardHeader>
            <CardTitle>Assign SOP training</CardTitle>
            <CardDescription>Department Head assigns SOP + Trainer to employees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>SOP</Label>
                <Select value={sopId} onValueChange={setSopId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select SOP" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_SOPS.filter((s) => s.status === "approved").map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.sopNumber} — {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trainer</Label>
                <Select value={trainerId} onValueChange={setTrainerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user_trainer">Vikram Singh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Employees</Label>
              {DEMO_EMPLOYEES.filter((e) => e.status === "active" || e.status === "handed_over").map(
                (e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(e.id)}
                      onCheckedChange={(c) =>
                        setSelected((prev) =>
                          c ? [...prev, e.id] : prev.filter((x) => x !== e.id)
                        )
                      }
                    />
                    {e.firstName} {e.lastName} ({e.employeeCode})
                  </label>
                )
              )}
            </div>
            <Button
              onClick={() => {
                if (!sopId || !selected.length) {
                  toast.error("Select SOP and at least one employee");
                  return;
                }
                toast.success(`Assigned training to ${selected.length} employee(s)`);
              }}
            >
              Assign training
            </Button>
          </CardContent>
        </Card>
      </RequirePermission>

      <Card>
        <CardHeader>
          <CardTitle>Training assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>SOP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_ASSIGNMENTS.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.id}</TableCell>
                  <TableCell>{a.employeeId}</TableCell>
                  <TableCell>{a.sopId}</TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                  <TableCell>{a.score != null ? `${a.score}%` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
