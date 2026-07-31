"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/auth/require-permission";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  const [trainerId, setTrainerId] = useState("");

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
                    <SelectItem value="__none" disabled>
                      No approved SOPs yet
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trainer</Label>
                <Select value={trainerId} onValueChange={setTrainerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select trainer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none" disabled>
                      No trainers listed yet
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">No employees available for assignment yet.</p>
            <Button
              onClick={() => {
                toast.error("Create SOPs and employees first, then assign training");
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
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No training assignments yet.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
