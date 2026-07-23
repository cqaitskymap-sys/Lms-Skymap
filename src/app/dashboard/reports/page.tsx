"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { DEMO_STATS } from "@/lib/demo/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const complianceByDept = [
  { name: "QA", rate: 92 },
  { name: "Production", rate: 84 },
  { name: "Warehouse", rate: 78 },
];

const statusDist = [
  { name: "Passed", value: 45, color: "hsl(152, 61%, 36%)" },
  { name: "In progress", value: 18, color: "hsl(199, 89%, 40%)" },
  { name: "Failed / Retrain", value: 7, color: "hsl(0, 72%, 51%)" },
  { name: "Overdue", value: 4, color: "hsl(38, 92%, 45%)" },
];

export default function ReportsPage() {
  const exportReport = () => {
    const ws = XLSX.utils.json_to_sheet([
      DEMO_STATS,
      ...complianceByDept.map((d) => ({ department: d.name, compliance: d.rate })),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Compliance Report");
    XLSX.writeFile(wb, "compliance-report.xlsx");
    toast.success("Report exported");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Compliance dashboard and exports</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportReport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compliance by department</CardTitle>
            <CardDescription>Training completion %</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complianceByDept}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="rate" fill="hsl(199, 89%, 32%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Training status distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusDist.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
