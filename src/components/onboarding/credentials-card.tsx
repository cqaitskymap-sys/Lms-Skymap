"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldAlert,
} from "lucide-react";
import type { OnboardingCredentials } from "@/lib/services/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CredentialsCardProps {
  credentials: OnboardingCredentials;
  employeeName: string;
  emailStatus?: { sent: boolean; reason?: string };
  onDone?: () => void;
}

export function CredentialsCard({
  credentials,
  employeeName,
  emailStatus,
  onDone,
}: CredentialsCardProps) {
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const copyAll = async () => {
    const block = [
      `Employee: ${employeeName}`,
      `Username: ${credentials.username}`,
      `Email: ${credentials.email}`,
      `Temporary password: ${credentials.temporaryPassword}`,
      `Login: ${credentials.loginUrl}`,
    ].join("\n");
    await copy("All credentials", block);
  };

  return (
    <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-transparent">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-cyan-700" />
              Login credentials
            </CardTitle>
            <CardDescription>
              Shown once — share securely with {employeeName}. They must change the password on
              first login.
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            One-time
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Temporary password is never stored. Copy it now or email it to yourself before leaving
          this page.
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["Employee code", credentials.employeeCode],
              ["Username", credentials.username],
              ["Email", credentials.email],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border bg-background/80 px-3 py-2 sm:col-span-1"
            >
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 flex items-center justify-between gap-2 font-mono text-sm font-semibold">
                <span className="truncate">{value}</span>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
                  onClick={() => void copy(label, value)}
                  aria-label={`Copy ${label}`}
                >
                  {copied === label ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </dd>
            </div>
          ))}

          <div className="rounded-lg border bg-background/80 px-3 py-2 sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Temporary password</dt>
            <dd className="mt-1 flex items-center justify-between gap-2 font-mono text-sm font-semibold">
              <span className="truncate">
                {showPassword ? credentials.temporaryPassword : "••••••••••••"}
              </span>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  onClick={() => void copy("Password", credentials.temporaryPassword)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          {emailStatus?.sent
            ? "Credentials emailed to HR inbox."
            : emailStatus?.reason || "Email not sent — copy credentials manually."}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void copyAll()}>
            <Copy className="mr-2 h-4 w-4" />
            Copy all
          </Button>
          {onDone && (
            <Button type="button" onClick={onDone}>
              Continue to employee profile
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
