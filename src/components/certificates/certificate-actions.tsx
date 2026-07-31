"use client";

import { useCallback, useRef, useState } from "react";
import { Download, Loader2, Printer, Upload } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { TrainingCertificate } from "@/components/certificates/training-certificate";
import { Button } from "@/components/ui/button";
import {
  buildCertificatePdf,
  downloadBlob,
} from "@/lib/certificates/pdf";
import { uploadCertificatePdf } from "@/lib/services/certificates";
import type { Certificate } from "@/types";

interface CertificateActionsProps {
  certificate: Certificate;
  onUploaded?: (cert: Certificate) => void;
}

export function CertificateActions({ certificate, onUploaded }: CertificateActionsProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string | undefined>(certificate.qrCodeImageUrl);
  const [busy, setBusy] = useState<"pdf" | "print" | "upload" | null>(null);

  const ensureQr = useCallback(async () => {
    if (qr) return qr;
    const data = await QRCode.toDataURL(certificate.qrCodeData, {
      width: 256,
      margin: 1,
      color: { dark: "#0B3D4A", light: "#FFFFFFF0" },
    });
    setQr(data);
    return data;
  }, [certificate.qrCodeData, qr]);

  const handlePrint = async () => {
    setBusy("print");
    try {
      await ensureQr();
      // Allow paint
      await new Promise((r) => setTimeout(r, 50));
      window.print();
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadPdf = async () => {
    setBusy("pdf");
    try {
      const qrUrl = await ensureQr();
      if (certificate.pdfDownloadUrl?.startsWith("data:") || certificate.pdfDownloadUrl?.startsWith("http")) {
        // Prefer stored PDF when available (http)
        if (certificate.pdfDownloadUrl.startsWith("http")) {
          window.open(certificate.pdfDownloadUrl, "_blank");
          return;
        }
      }
      const blob = await buildCertificatePdf(certificate, qrUrl);
      downloadBlob(blob, `${certificate.certificateNumber}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setBusy(null);
    }
  };

  const handleUploadStorage = async () => {
    setBusy("upload");
    try {
      const qrUrl = await ensureQr();
      const blob = await buildCertificatePdf(certificate, qrUrl);
      const urls = await uploadCertificatePdf(certificate.id, blob);
      toast.success("Certificate stored in Firebase Storage");
      onUploaded?.({
        ...certificate,
        ...urls,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Storage upload failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <Button
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={() => void handlePrint()}
        >
          {busy === "print" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Printer className="mr-2 h-4 w-4" />
          )}
          Print certificate
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={() => void handleDownloadPdf()}
        >
          {busy === "pdf" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download PDF
        </Button>
        <Button
          size="sm"
          disabled={!!busy}
          onClick={() => void handleUploadStorage()}
        >
          {busy === "upload" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Store in Firebase
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-muted/20 p-4 print:border-0 print:bg-transparent print:p-0">
        <TrainingCertificate
          ref={sheetRef}
          certificate={certificate}
          qrDataUrl={qr}
        />
      </div>
    </div>
  );
}
