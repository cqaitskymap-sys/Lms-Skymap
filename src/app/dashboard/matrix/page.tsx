"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function MatrixPage() {
  const exportMatrix = () => {
    toast.error("No employees or SOPs to export yet");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Matrix</h1>
          <p className="text-muted-foreground">Employee × SOP compliance grid</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportMatrix}>
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance matrix</CardTitle>
          <CardDescription>Add employees and approved SOPs to populate this grid</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No matrix data yet.{" "}
            <StatusBadge status="not_assigned" />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
