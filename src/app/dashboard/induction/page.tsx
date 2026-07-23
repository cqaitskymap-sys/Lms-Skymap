"use client";

import Link from "next/link";
import { DEMO_INDUCTION_MODULES } from "@/lib/demo/data";
import { PdfViewer } from "@/components/shared/pdf-viewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function InductionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Induction</h1>
        <p className="text-muted-foreground">Onboarding modules, documents & assessment</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {DEMO_INDUCTION_MODULES.map((m) => (
          <Card key={m.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <CardDescription>{m.description}</CardDescription>
                </div>
                {m.isMandatory && <Badge>Mandatory</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">~{m.estimatedMinutes} min</span>
                <span>Pass ≥ {m.passPercentage}%</span>
              </div>
              <Progress value={m.id === "ind_001" ? 100 : 0} />
              {m.documents[0] && (
                <PdfViewer url={m.documents[0].downloadUrl} title={m.documents[0].title} />
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  Mark studied
                </Button>
                <Button size="sm" asChild>
                  <Link href="/dashboard/exams">Take assessment</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
