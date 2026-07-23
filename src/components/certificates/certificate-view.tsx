"use client";

import { useRef } from "react";
import { Award, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { Certificate } from "@/types";

interface CertificateViewProps {
  certificate: Certificate;
  employeeName: string;
  sopTitle: string;
  sopNumber: string;
  qrDataUrl?: string;
  signatureUrl?: string;
}

export function CertificateView({
  certificate,
  employeeName,
  sopTitle,
  sopNumber,
  qrDataUrl,
  signatureUrl,
}: CertificateViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export / Print
        </Button>
      </div>

      <div
        ref={ref}
        className="relative mx-auto max-w-3xl border-4 border-primary/20 bg-gradient-to-br from-slate-50 to-cyan-50 p-10 text-center shadow-lg dark:from-slate-900 dark:to-slate-800 print:shadow-none"
      >
        <div className="absolute inset-3 border border-primary/30" />
        <div className="relative space-y-6">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Award className="h-8 w-8" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">
              PharmaLMS Training Certificate
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Certificate of Completion
          </h1>

          <p className="text-muted-foreground">This is to certify that</p>
          <p className="text-2xl font-semibold text-primary">{employeeName}</p>
          <p className="text-muted-foreground">
            has successfully completed training on
          </p>
          <p className="text-xl font-medium">
            {sopNumber} — {sopTitle}
          </p>

          <div className="mx-auto grid max-w-md grid-cols-2 gap-4 pt-4 text-sm">
            <div>
              <p className="text-muted-foreground">Score</p>
              <p className="font-semibold">{certificate.percentage}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Issued</p>
              <p className="font-semibold">{formatDate(certificate.issuedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Certificate No.</p>
              <p className="font-mono text-xs font-semibold">{certificate.certificateNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Verification</p>
              <p className="font-mono text-xs">{certificate.verificationHash.slice(0, 12)}…</p>
            </div>
          </div>

          <div className="flex items-end justify-between pt-8">
            <div className="text-left">
              {signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signatureUrl} alt="Digital signature" className="h-12 object-contain" />
              ) : (
                <div className="h-12 w-32 border-b border-foreground/40" />
              )}
              <p className="mt-1 text-xs text-muted-foreground">Authorized Signatory</p>
              <p className="text-xs italic">Digitally signed</p>
            </div>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Verification QR" className="h-24 w-24" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
