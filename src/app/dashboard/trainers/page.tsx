"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TrainersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trainers</h1>
        <p className="text-muted-foreground">Qualified trainers for SOP sessions</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Vikram Singh</CardTitle>
          <CardDescription>trainer@pharma.local</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge>GMP</Badge>
            <Badge variant="secondary">Document Control</Badge>
            <Badge variant="secondary">Deviation</Badge>
          </div>
          <p className="text-sm text-muted-foreground">12 sessions conducted · QA department</p>
        </CardContent>
      </Card>
    </div>
  );
}
