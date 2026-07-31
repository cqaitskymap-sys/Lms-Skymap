"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportDataset } from "@/lib/reports/types";

interface ReportTableProps {
  dataset: ReportDataset;
}

export function ReportTable({ dataset }: ReportTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{dataset.title}</CardTitle>
        <CardDescription>
          {dataset.rows.length} row{dataset.rows.length === 1 ? "" : "s"} ·{" "}
          {dataset.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {!dataset.rows.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No rows match the current filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {dataset.columns.map((c) => (
                  <TableHead key={c.key} className="whitespace-nowrap">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataset.rows.map((row, i) => (
                <TableRow key={i}>
                  {dataset.columns.map((c) => (
                    <TableCell key={c.key} className="max-w-[220px] truncate text-sm">
                      {row[c.key] == null ? "—" : String(row[c.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
