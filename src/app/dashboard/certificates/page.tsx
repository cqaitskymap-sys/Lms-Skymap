"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { DEMO_CERTIFICATES, DEMO_EMPLOYEES, DEMO_SOPS } from "@/lib/demo/data";
import { CertificateView } from "@/components/certificates/certificate-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function CertificatesPage() {
  const [selected, setSelected] = useState(DEMO_CERTIFICATES[0]?.id);
  const [qr, setQr] = useState<string>();

  const cert = DEMO_CERTIFICATES.find((c) => c.id === selected);
  const employee = DEMO_EMPLOYEES.find((e) => e.id === cert?.employeeId);
  const sop = DEMO_SOPS.find((s) => s.id === cert?.sopId);

  useEffect(() => {
    if (!cert) return;
    QRCode.toDataURL(cert.qrCodeData, { width: 160, margin: 1 }).then(setQr);
  }, [cert]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
        <p className="text-muted-foreground">QR-verified training certificates with digital signature</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issued certificates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_CERTIFICATES.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.certificateNumber}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell>{c.percentage}%</TableCell>
                  <TableCell>{formatDate(c.issuedAt)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setSelected(c.id)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {cert && employee && sop && (
        <CertificateView
          certificate={cert}
          employeeName={`${employee.firstName} ${employee.lastName}`}
          sopTitle={sop.title}
          sopNumber={sop.sopNumber}
          qrDataUrl={qr}
        />
      )}
    </div>
  );
}
