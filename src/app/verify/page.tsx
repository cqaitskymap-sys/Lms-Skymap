"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { verifyCertificate, getCertificateByNumber } from "@/lib/services/certificates";
import { TrainingCertificate } from "@/components/certificates/training-certificate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Certificate, CertificateVerification } from "@/types";
import QRCode from "qrcode";

function VerifyInner() {
  const params = useParams<{ number?: string }>();
  const search = useSearchParams();
  const initial =
    (typeof params?.number === "string" ? decodeURIComponent(params.number) : "") ||
    search.get("n") ||
    "";

  const [number, setNumber] = useState(initial || "CERT-2026-100234");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CertificateVerification | null>(null);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [qr, setQr] = useState<string>();

  const runVerify = async (value: string) => {
    setLoading(true);
    setResult(null);
    setCert(null);
    try {
      const verification = await verifyCertificate(value);
      setResult(verification);
      if (verification.valid) {
        const full = await getCertificateByNumber(value);
        setCert(full);
        if (full) {
          const url =
            full.qrCodeImageUrl ||
            (await QRCode.toDataURL(full.qrCodeData, { width: 200, margin: 1 }));
          setQr(url);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initial) void runVerify(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div
      className="min-h-screen px-4 py-12"
      style={{
        background:
          "radial-gradient(ellipse at top, #e8f2f4 0%, #f7f5f0 45%, #f0ebe3 100%)",
      }}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/skymap-logo.png" alt="SKYMAP" className="h-8 w-auto object-contain" />
          </Link>
          <div className="mt-4 flex items-center justify-center gap-2">
            <ShieldCheck className="h-7 w-7" style={{ color: "#0b3d4a" }} />
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0b3d4a" }}>
              Certificate verification
            </h1>
          </div>
          <p className="text-muted-foreground">
            Enter a certificate number or open a QR link to validate authenticity
          </p>
        </div>

        <Card className="mx-auto max-w-lg border-[#0b3d4a]/15">
          <CardHeader>
            <CardTitle className="text-base">Verify</CardTitle>
            <CardDescription>Public endpoint — no login required</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Certificate number</Label>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="CERT-2026-XXXXXX"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runVerify(number);
                }}
              />
            </div>
            <Button
              className="w-full"
              style={{ background: "#0b3d4a" }}
              disabled={loading}
              onClick={() => void runVerify(number)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify certificate
            </Button>
          </CardContent>
        </Card>

        {result?.valid && (
          <Card className="border-emerald-500/40">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <p className="text-lg font-semibold text-emerald-700">Valid certificate</p>
              <div className="grid w-full max-w-md gap-1 text-sm sm:grid-cols-2 sm:text-left">
                <p>
                  <span className="text-muted-foreground">Holder:</span> {result.employeeName}
                </p>
                <p>
                  <span className="text-muted-foreground">Employee ID:</span>{" "}
                  {result.employeeCode}
                </p>
                <p>
                  <span className="text-muted-foreground">Department:</span>{" "}
                  {result.departmentName}
                </p>
                <p>
                  <span className="text-muted-foreground">Trainer:</span> {result.trainerName}
                </p>
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">SOP:</span> {result.sopNumber} —{" "}
                  {result.sopTitle}
                </p>
                <p>
                  <span className="text-muted-foreground">Score:</span> {result.percentage}%
                </p>
                <p>
                  <span className="text-muted-foreground">Issued:</span>{" "}
                  {formatDate(result.issuedAt)}
                </p>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground break-all">
                Hash: {result.verificationHash}
              </p>
            </CardContent>
          </Card>
        )}

        {result && !result.valid && (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-lg font-semibold text-destructive">
                {result.revoked ? "Revoked certificate" : "Invalid certificate"}
              </p>
              <p className="text-sm text-muted-foreground">{result.message}</p>
            </CardContent>
          </Card>
        )}

        {cert && result?.valid && (
          <div className="overflow-x-auto rounded-lg border bg-white/60 p-4">
            <TrainingCertificate certificate={cert} qrDataUrl={qr} compact />
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading verifier…
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
