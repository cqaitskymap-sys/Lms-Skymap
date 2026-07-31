"use client";

import { Download, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportReportCsv,
  exportReportExcel,
  exportReportPdf,
} from "@/lib/reports/export";
import type { ReportDataset } from "@/lib/reports/types";
import { Can } from "@/components/auth/require-permission";

interface ReportExportMenuProps {
  dataset: ReportDataset;
}

export function ReportExportMenu({ dataset }: ReportExportMenuProps) {
  const run = (kind: "excel" | "csv" | "pdf") => {
    try {
      if (kind === "excel") exportReportExcel(dataset);
      else if (kind === "csv") exportReportCsv(dataset);
      else exportReportPdf(dataset);
      toast.success(`Exported ${dataset.title} as ${kind.toUpperCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <Can permission="reports:export">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => run("excel")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("csv")}>
            <Sheet className="mr-2 h-4 w-4" /> CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("pdf")}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Can>
  );
}
