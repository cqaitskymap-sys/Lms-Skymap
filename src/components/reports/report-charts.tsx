"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportDataset } from "@/lib/reports/types";

const PALETTE = [
  "hsl(199, 89%, 32%)",
  "hsl(152, 61%, 36%)",
  "hsl(38, 92%, 45%)",
  "hsl(0, 72%, 51%)",
  "hsl(215, 28%, 35%)",
  "hsl(173, 58%, 39%)",
];

interface ReportChartsProps {
  dataset: ReportDataset;
}

export function ReportCharts({ dataset }: ReportChartsProps) {
  if (!dataset.charts.length) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {dataset.charts.map((chart) => (
        <Card key={chart.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{chart.title}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {chart.kind === "pie" ? (
                <PieChart>
                  <Pie
                    data={chart.data}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                  >
                    {chart.data.map((e, i) => (
                      <Cell key={e.name} fill={e.fill || PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              ) : chart.kind === "line" ? (
                <LineChart data={chart.data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={PALETTE[0]}
                    strokeWidth={2}
                  />
                </LineChart>
              ) : (
                <BarChart data={chart.data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
