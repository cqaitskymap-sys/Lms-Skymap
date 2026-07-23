"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RequirePermission } from "@/components/auth/require-permission";

export default function JdPage() {
  const [responsibilities, setResponsibilities] = useState("1. Execute assigned QA activities\n2. Maintain documentation as per SOP");

  return (
    <RequirePermission permission={["jd:read", "jd:write"]}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Description</h1>
          <p className="text-muted-foreground">Department Head creates JD after handover</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create / update JD</CardTitle>
            <CardDescription>Linked to employee after induction handover</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("Job Description saved");
              }}
            >
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input defaultValue="emp_001" required />
              </div>
              <div className="space-y-2">
                <Label>Job title</Label>
                <Input defaultValue="QA Officer" required />
              </div>
              <div className="space-y-2">
                <Label>Responsibilities (one per line)</Label>
                <Textarea
                  rows={5}
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Qualifications</Label>
                <Textarea rows={3} defaultValue="B.Pharm / M.Sc\n1+ years pharma experience preferred" />
              </div>
              <div className="space-y-2">
                <Label>Skills</Label>
                <Textarea rows={2} defaultValue="GMP, Documentation, Attention to detail" />
              </div>
              <div className="space-y-2">
                <Label>Effective from</Label>
                <Input type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <Button type="submit">Save JD</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
