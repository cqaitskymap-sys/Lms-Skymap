"use client";

import { useState } from "react";
import { DEMO_CERTIFICATES, DEMO_EMPLOYEES, DEMO_SOPS } from "@/lib/demo/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

export default function VerifyPage() {
  const [number, setNumber] = useState("CERT-2026-100234");
  const [result, setResult] = useState<"valid" | "invalid" | null>(null);
  const [certId, setCertId] = useState<string | null>(null);

  const verify = () => {
    const found = DEMO_CERTIFICATES.find(
      (c) => c.certificateNumber === number.trim() && !c.isRevoked
    );
    setResult(found ? "valid" : "invalid");
    setCertId(found?.id || null);
  };

  const cert = DEMO_CERTIFICATES.find((c) => c.id === certId);
  const employee = DEMO_EMPLOYEES.find((e) => e.id === cert?.employeeId);
  const sop = DEMO_SOPS.find((s) => s.id === cert?.sopId);

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-16">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← PharmaLMS
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Certificate verification</h1>
          <p className="text-muted-foreground">Enter certificate number or scan QR code</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verify</CardTitle>
            <CardDescription>Public verification endpoint</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Certificate number</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <Button className="w-full" onClick={verify}>
              Verify
            </Button>
          </CardContent>
        </Card>

        {result === "valid" && cert && (
          <Card className="border-success/40">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="text-lg font-semibold text-success">Valid certificate</p>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Holder:</span>{" "}
                  {employee ? `${employee.firstName} ${employee.lastName}` : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Training:</span>{" "}
                  {sop ? `${sop.sopNumber} — ${sop.title}` : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Score:</span> {cert.percentage}%
                </p>
                <p>
                  <span className="text-muted-foreground">Issued:</span> {formatDate(cert.issuedAt)}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  Hash: {cert.verificationHash}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {result === "invalid" && (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-lg font-semibold text-destructive">Invalid or revoked</p>
              <p className="text-sm text-muted-foreground">
                No matching active certificate was found.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
