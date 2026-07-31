"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { deleteCertificate, listCertificates } from "@/lib/services/certificates";
import { CERTIFICATES_UPDATED_EVENT } from "@/lib/certificates/demo-store";
import { CertificateActions } from "@/components/certificates/certificate-actions";
import { RequirePermission } from "@/components/auth/require-permission";
import { AdminDeleteButton } from "@/components/auth/admin-delete-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Certificate } from "@/types";
import Link from "next/link";

export default function CertificatesPage() {
  const { profile, role } = useAuth();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [selected, setSelected] = useState<string>();
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const employeeOnly = role === "employee" ? profile?.employeeId : undefined;
      const rows = await listCertificates(
        employeeOnly ? { employeeId: employeeOnly } : undefined
      );
      setCerts(rows);
      if (!selected && rows[0]) setSelected(rows[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(CERTIFICATES_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(CERTIFICATES_UPDATED_EVENT, onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.employeeId, role]);

  const cert = certs.find((c) => c.id === selected);

  useEffect(() => {
    if (!cert || cert.qrCodeImageUrl) return;
    void QRCode.toDataURL(cert.qrCodeData, { width: 256, margin: 1 }).then((url) => {
      setCerts((prev) =>
        prev.map((c) => (c.id === cert.id ? { ...c, qrCodeImageUrl: url } : c))
      );
    });
  }, [cert]);

  return (
    <RequirePermission permission={["certificates:read", "assessments:read", "exams:read"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
            <p className="text-muted-foreground">
              Auto-issued training certificates with QR verification & PDF storage
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/verify" target="_blank">
              Open verification page
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issued certificates</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>SOP</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certs.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">
                        {c.certificateNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{c.employeeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.employeeCode} · {c.departmentName}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{c.sopNumber}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {c.sopTitle}
                        </p>
                      </TableCell>
                      <TableCell>{c.trainerName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.percentage}%</Badge>
                      </TableCell>
                      <TableCell>{formatDate(c.issuedAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={selected === c.id ? "default" : "outline"}
                            onClick={() => setSelected(c.id)}
                          >
                            View
                          </Button>
                          <AdminDeleteButton
                            confirmTitle={`Delete certificate ${c.certificateNumber}?`}
                            confirmDescription="This certificate record will be removed permanently."
                            successMessage="Certificate deleted"
                            onDelete={async () => {
                              await deleteCertificate(c.id);
                              if (selected === c.id) setSelected(undefined);
                              await refresh();
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!certs.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No certificates yet — pass an assessment to auto-issue one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {cert && (
          <CertificateActions
            certificate={cert}
            onUploaded={(updated) => {
              setCerts((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c))
              );
            }}
          />
        )}
      </div>
    </RequirePermission>
  );
}
