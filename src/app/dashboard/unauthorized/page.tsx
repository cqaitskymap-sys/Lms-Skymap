"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ROLE_DASHBOARD_ROUTES, ROLE_LABELS } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function UnauthorizedContent() {
  const { role, profile } = useAuth();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const home = role ? ROLE_DASHBOARD_ROUTES[role] : "/dashboard";

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldOff className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Unauthorized</CardTitle>
          <CardDescription>
            You do not have permission to access this area
            {role ? ` as ${ROLE_LABELS[role]}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {from && (
            <p className="break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Requested: {from}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Signed in as {profile?.email || "unknown"}. Contact your administrator if you believe
            this is a mistake — this attempt may be logged for compliance.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href={home}>Go to my dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/settings">Profile settings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense>
      <UnauthorizedContent />
    </Suspense>
  );
}
