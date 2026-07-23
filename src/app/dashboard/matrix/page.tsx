"use client";

import { DEMO_EMPLOYEES, DEMO_SOPS, DEMO_ASSIGNMENTS } from "@/lib/demo/data";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function MatrixPage() {
  const employees = DEMO_EMPLOYEES.filter((e) => e.departmentId === "dept_qa" || e.status === "active");
  const sops = DEMO_SOPS.filter((s) => s.status === "approved");

  const cell = (empId: string, sopId: string) => {
    const a = DEMO_ASSIGNMENTS.find((x) => x.employeeId === empId && x.sopId === sopId);
    return a?.status || "not_assigned";
  };

  const exportMatrix = () => {
    const rows = employees.map((e) => {
      const row: Record<string, string> = {
        Employee: `${e.firstName} ${e.lastName}`,
        Code: e.employeeCode,
      };
      for (const s of sops) {
        row[s.sopNumber] = cell(e.id, s.id);
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Training Matrix");
    XLSX.writeFile(wb, "training-matrix.xlsx");
    toast.success("Matrix exported");
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
          <CardDescription>Hover status badges for training state</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium">Employee</th>
                {sops.map((s) => (
                  <th key={s.id} className="p-2 text-left font-medium">
                    {s.sopNumber}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="p-2 font-medium">
                    {e.firstName} {e.lastName}
                  </td>
                  {sops.map((s) => (
                    <td key={s.id} className="p-2">
                      <StatusBadge status={cell(e.id, s.id)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
