/**
 * Export report datasets to CSV, Excel, and PDF.
 */

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import type { ReportDataset } from "@/lib/reports/types";

function slug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportCsv(dataset: ReportDataset) {
  const headers = dataset.columns.map((c) => c.label);
  const keys = dataset.columns.map((c) => c.key);
  const lines = [
    headers.join(","),
    ...dataset.rows.map((row) =>
      keys
        .map((k) => {
          const v = row[k];
          const s = v == null ? "" : String(v);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${slug(dataset.title)}.csv`);
}

export function exportReportExcel(dataset: ReportDataset) {
  const sheetRows = dataset.rows.map((row) => {
    const out: Record<string, string | number | boolean | null> = {};
    for (const col of dataset.columns) {
      out[col.label] = row[col.key] ?? "";
    }
    return out;
  });

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(sheetRows.length ? sheetRows : [{ Note: "No rows" }]);
  XLSX.utils.book_append_sheet(wb, wsData, dataset.title.slice(0, 28) || "Report");

  const kpiSheet = XLSX.utils.json_to_sheet(
    dataset.kpis.map((k) => ({ Metric: k.label, Value: k.value }))
  );
  XLSX.utils.book_append_sheet(wb, kpiSheet, "KPIs");

  XLSX.writeFile(wb, `${slug(dataset.title)}.xlsx`);
}

export function exportReportPdf(dataset: ReportDataset) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(11, 61, 74);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(dataset.title, 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(dataset.description, 14, 18);

  doc.setTextColor(40);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date(dataset.generatedAt).toLocaleString("en-IN")}`, 14, 30);

  let y = 36;
  dataset.kpis.forEach((k, i) => {
    const x = 14 + (i % 4) * 70;
    if (i > 0 && i % 4 === 0) y += 8;
    doc.setFont("helvetica", "bold");
    doc.text(String(k.value), x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(k.label, x, y + 4);
    doc.setTextColor(40);
  });
  y += 14;

  const colCount = Math.min(dataset.columns.length, 8);
  const cols = dataset.columns.slice(0, colCount);
  const usable = pageW - 28;
  const colW = usable / colCount;

  doc.setFillColor(232, 240, 242);
  doc.rect(14, y - 4, usable, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  cols.forEach((c, i) => {
    doc.text(c.label.slice(0, 18), 14 + i * colW + 1, y);
  });
  y += 6;

  doc.setFont("helvetica", "normal");
  for (const row of dataset.rows) {
    if (y > 190) {
      doc.addPage();
      y = 20;
    }
    cols.forEach((c, i) => {
      const v = row[c.key];
      doc.text(String(v ?? "").slice(0, 22), 14 + i * colW + 1, y);
    });
    y += 5;
  }

  if (dataset.rows.length > 35) {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Showing rows in paginated PDF · total ${dataset.rows.length}`, 14, 200);
  }

  doc.save(`${slug(dataset.title)}.pdf`);
}
