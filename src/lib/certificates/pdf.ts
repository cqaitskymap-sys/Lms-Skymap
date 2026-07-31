/**
 * Certificate PDF generation (A4 landscape) via jsPDF.
 */

import { jsPDF } from "jspdf";
import type { Certificate } from "@/types";
import { formatDate } from "@/lib/utils";

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith("data:")) return url;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Build a professional landscape certificate PDF and return as Blob. */
export async function buildCertificatePdf(
  certificate: Certificate,
  qrDataUrl?: string
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Background
  doc.setFillColor(250, 248, 243);
  doc.rect(0, 0, w, h, "F");

  // Outer border
  doc.setDrawColor(11, 61, 74);
  doc.setLineWidth(1.2);
  doc.rect(8, 8, w - 16, h - 16);

  // Inner gold border
  doc.setDrawColor(184, 148, 74);
  doc.setLineWidth(0.4);
  doc.rect(11, 11, w - 22, h - 22);

  // Corner ornaments
  doc.setDrawColor(184, 148, 74);
  doc.setLineWidth(0.6);
  const o = 16;
  [
    [o, o, o + 12, o, o, o + 12],
    [w - o, o, w - o - 12, o, w - o, o + 12],
    [o, h - o, o + 12, h - o, o, h - o - 12],
    [w - o, h - o, w - o - 12, h - o, w - o, h - o - 12],
  ].forEach(([x1, y1, x2, y2, x3, y3]) => {
    doc.line(x1, y1, x2, y2);
    doc.line(x1, y1, x3, y3);
  });

  // Logo
  const logo =
    (certificate.companyLogoUrl &&
      (await loadImageAsDataUrl(certificate.companyLogoUrl))) ||
    null;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", w / 2 - 10, 18, 20, 20);
    } catch {
      /* svg may fail in jspdf — skip */
    }
  }

  doc.setTextColor(11, 61, 74);
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(certificate.companyName.toUpperCase(), w / 2, logo ? 42 : 28, {
    align: "center",
  });

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(184, 148, 74);
  doc.text("TRAINING CERTIFICATE", w / 2, logo ? 49 : 35, { align: "center" });

  doc.setTextColor(11, 61, 74);
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.text("Certificate of Completion", w / 2, 62, { align: "center" });

  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text("This is to certify that", w / 2, 74, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(11, 61, 74);
  doc.text(certificate.employeeName, w / 2, 86, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `Employee ID: ${certificate.employeeCode}  ·  Department: ${certificate.departmentName}`,
    w / 2,
    94,
    { align: "center" }
  );

  doc.text("has successfully completed training on", w / 2, 104, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.setTextColor(11, 61, 74);
  doc.text(`${certificate.sopNumber} — ${certificate.sopTitle}`, w / 2, 113, {
    align: "center",
  });

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `Trainer: ${certificate.trainerName}  ·  Score: ${certificate.percentage}%  ·  Issued: ${formatDate(certificate.issuedAt)}`,
    w / 2,
    122,
    { align: "center" }
  );

  doc.setFontSize(9);
  doc.text(`Certificate No. ${certificate.certificateNumber}`, w / 2, 130, {
    align: "center",
  });

  // Signature
  const sig =
    (certificate.digitalSignatureUrl &&
      (await loadImageAsDataUrl(certificate.digitalSignatureUrl))) ||
    null;
  const sigX = 40;
  const sigY = h - 48;
  if (sig) {
    try {
      doc.addImage(sig, "PNG", sigX, sigY - 12, 45, 14);
    } catch {
      doc.setDrawColor(11, 61, 74);
      doc.line(sigX, sigY, sigX + 45, sigY);
    }
  } else {
    doc.setDrawColor(11, 61, 74);
    doc.line(sigX, sigY, sigX + 45, sigY);
  }
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(11, 61, 74);
  doc.text(certificate.signedBy || "Authorized Signatory", sigX + 22, sigY + 6, {
    align: "center",
  });
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(certificate.signedByTitle || "Digitally signed", sigX + 22, sigY + 11, {
    align: "center",
  });

  // QR
  const qr = qrDataUrl || certificate.qrCodeImageUrl;
  if (qr) {
    try {
      doc.addImage(qr, "PNG", w - 55, h - 52, 32, 32);
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text("Scan to verify", w - 39, h - 17, { align: "center" });
    } catch {
      /* ignore */
    }
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
