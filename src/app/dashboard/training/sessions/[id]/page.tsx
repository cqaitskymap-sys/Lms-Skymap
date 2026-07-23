"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { DEMO_EMPLOYEES } from "@/lib/demo/data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function TrainingSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({
    emp_001: true,
    emp_002: false,
  });
  const [notes, setNotes] = useState("");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training session</h1>
        <p className="text-muted-foreground font-mono text-sm">{id}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mark attendance</CardTitle>
          <CardDescription>Trainer records presence and completes the session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DEMO_EMPLOYEES.slice(0, 2).map((e) => (
            <label key={e.id} className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox
                checked={!!attendance[e.id]}
                onCheckedChange={(c) =>
                  setAttendance((prev) => ({ ...prev, [e.id]: !!c }))
                }
              />
              <div>
                <p className="text-sm font-medium">
                  {e.firstName} {e.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{e.employeeCode}</p>
              </div>
            </label>
          ))}
          <div className="space-y-2">
            <Label>Session notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Topics covered, Q&A summary…"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => toast.success("Attendance saved")}
            >
              Save attendance
            </Button>
            <Button
              onClick={() =>
                toast.success("Session completed — assessments unlocked for attendees")
              }
            >
              Complete session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
