"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { AppProviders } from "@/components/providers/app-providers";
import { requestPasswordReset } from "@/lib/services/auth";
import { resolveLoginIdentifier } from "@/lib/services/onboarding";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/auth/schemas";
import { isDemoMode } from "@/lib/demo/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function isMissingAccount(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "auth/user-not-found" || code === "auth/invalid-email";
}

function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [needsHr, setNeedsHr] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      const email = await resolveLoginIdentifier(data.email);
      if (email.endsWith("@pharma.local")) {
        setNeedsHr(true);
        return;
      }
      await requestPasswordReset(email);
      setSent(true);
      toast.success(
        isDemoMode()
          ? "Demo mode: password reset simulated"
          : "If an account exists, a reset link has been sent"
      );
    } catch (err) {
      if (isMissingAccount(err)) {
        setNeedsHr(true);
        return;
      }
      toast.error(
        err instanceof Error ? err.message : "Could not send a reset link. Try again."
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-cyan-50/50 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Card className="w-full max-w-md border-border/60 shadow-lift">
        <CardHeader>
          <CardTitle className="font-display text-3xl font-semibold">Forgot password</CardTitle>
          <CardDescription>
            Enter your employee code. Staff passwords are reset by HR.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {needsHr ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                This account signs in with an employee code. A reset email cannot reach it. Ask HR
                to reset the password from User Management, then sign in with the temporary password
                on the credentials card.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to sign in
                </Link>
              </Button>
            </div>
          ) : sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Check your inbox for a password reset link. The link expires for security. If you
                don&apos;t see it, check spam or contact HR.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to sign in
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Employee code or email</Label>
                <Input id="email" type="text" autoComplete="username" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send reset link
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/login">Cancel</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AppProviders>
      <ForgotPasswordForm />
    </AppProviders>
  );
}
