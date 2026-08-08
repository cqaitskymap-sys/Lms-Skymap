"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  deleteCertificate,
  listCertificates,
  revokeCertificate,
} from "@/lib/services/certificates";
import { CERTIFICATES_UPDATED_EVENT } from "@/lib/certificates/demo-store";
import { CertificateActions } from "@/components/certificates/certificate-actions";
import { RequirePermission, Can } from "@/components/auth/require-permission";
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
  const [error, setError] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      if (role === "employee" && !profile?.employeeId) {
        setCerts([]);
        setError("Your account is not linked to an employee profile.");
        return;
      }

      const employeeOnly = role === "employee" ? profile?.employeeId : undefined;
      let rows = await listCertificates(
        employeeOnly ? { employeeId: employeeOnly } : undefined
      );

      if (!rows.length && role === "employee" && profile?.employeeId) {
        try {
          const { auth } = await import("@/lib/firebase/client");
          const user = auth.currentUser;
          if (user) {
            const token = await user.getIdToken(true);
            const res = await fetch("/api/certificates/sync", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const body = (await res.json()) as { issuedCount?: number };
              if (body.issuedCount) {
                rows = await listCertificates({ employeeId: profile.employeeId });
              }
            } else {
              const body = (await res.json().catch(() => ({}))) as { error?: string };
              console.warn("[certificates] sync failed:", body.error || res.status);
            }
          }
        } catch (err) {
          console.warn("[certificates] sync error:", err);
        }
      }

      setCerts(rows);
      const visible = showRevoked ? rows : rows.filter((c) => !c.isRevoked);
      if (!selected || !visible.some((c) => c.id === selected)) {
        setSelected(visible[0]?.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load certificates");
      setCerts([]);
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
  }, [profile?.employeeId, role, showRevoked]);

  const visible = showRevoked ? certs : certs.filter((c) => !c.isRevoked);
  const cert = visible.find((c) => c.id === selected) || certs.find((c) => c.id === selected);

  useEffect(() => {
    if (!cert || cert.qrCodeImageUrl) return;
    void QRCode.toDataURL(cert.qrCodeData, { width: 256, margin: 1 }).then((url) => {
      setCerts((prev) =>
        prev.map((c) => (c.id === cert.id ? { ...c, qrCodeImageUrl: url } : c))
      );
    });
  }, [cert]);

  const canStore =
    role &&
    (hasPermission(role, "certificates:issue") || role === "super_admin" || role === "qa" || role === "hr");

  return (
    <RequirePermission permission="certificates:read">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
            <p className="text-muted-foreground">
              Auto-issued training certificates with QR verification & PDF storage
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRevoked((v) => !v)}
            >
              {showRevoked ? "Hide revoked" : "Show revoked"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/verify" target="_blank">
                Open verification page
              </Link>
            </Button>
          </div>
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
            ) : error ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={() => void refresh()}>
                  Retry
                </Button>
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
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((c) => (
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
                        {c.isRevoked ? (
                          <Badge variant="destructive">Revoked</Badge>
                        ) : (
                          <Badge variant="outline">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={selected === c.id ? "default" : "outline"}
                            onClick={() => setSelected(c.id)}
                          >
                            View
                          </Button>
                          <Can permission="certificates:revoke">
                            {!c.isRevoked && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => {
                                  const reason = window.prompt(
                                    "Revocation reason (required):"
                                  );
                                  if (!reason || reason.trim().length < 3) {
                                    toast.error("Provide a reason (min 3 characters)");
                                    return;
                                  }
                                  void revokeCertificate(c.id, reason.trim())
                                    .then(() => {
                                      toast.success("Certificate revoked");
                                      return refresh();
                                    })
                                    .catch((err) =>
                                      toast.error(
                                        err instanceof Error ? err.message : "Revoke failed"
                                      )
                                    );
                                }}
                              >
                                Revoke
                              </Button>
                            )}
                          </Can>
                          <AdminDeleteButton
                            confirmTitle={`Delete certificate ${c.certificateNumber}?`}
                            confirmDescription="Prefer Revoke for audit trail. Delete removes the record permanently."
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
                  {!visible.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
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
            allowUpload={!!canStore && !cert.isRevoked}
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
