"use client";

import { DEMO_DEPARTMENTS } from "@/lib/demo/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
        <p className="text-muted-foreground">Organizational units for SOP & training ownership</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {DEMO_DEPARTMENTS.map((d) => (
          <Card key={d.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{d.name}</CardTitle>
                <Badge variant="outline">{d.code}</Badge>
              </div>
              <CardDescription>{d.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {d.isActive ? "Active" : "Inactive"}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
