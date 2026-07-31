"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function TrainingSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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
          <p className="text-sm text-muted-foreground">No attendees assigned to this session yet.</p>
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
