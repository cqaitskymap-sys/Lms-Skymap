"use client";

import { use } from "react";
import { toast } from "sonner";
import { DEMO_SOPS } from "@/lib/demo/data";
import { StatusBadge } from "@/components/shared/status-badge";
import { PdfViewer } from "@/components/shared/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default function SopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sop = DEMO_SOPS.find((s) => s.id === id);

  if (!sop) return <p>SOP not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {sop.sopNumber} — {sop.title}
          </h1>
          <p className="text-muted-foreground">{sop.description}</p>
        </div>
        <StatusBadge status={sop.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current version document</CardTitle>
          </CardHeader>
          <CardContent>
            <PdfViewer
              url="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
              title={`${sop.sopNumber} current version`}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium">{sop.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Effective date</p>
                <p className="font-medium">{formatDate(sop.effectiveDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Version ID</p>
                <p className="font-mono text-xs">{sop.currentVersionId}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Version control</CardTitle>
              <CardDescription>Revisions auto-reassign training</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">v1.0 — Approved</p>
                <p className="text-xs text-muted-foreground">Initial release</p>
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() =>
                  toast.success("Revision uploaded", {
                    description: "Affected employees will be reassigned on approval.",
                  })
                }
              >
                Upload revision
              </Button>
              <Button
                className="w-full"
                onClick={() => toast.success("SOP approved & training reassignment queued")}
              >
                Approve version
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
