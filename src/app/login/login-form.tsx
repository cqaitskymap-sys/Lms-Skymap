"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const { signIn, isDemo } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(isDemo ? "admin@pharma.local" : "");
  const [password, setPassword] = useState(isDemo ? "Admin@123" : "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Signed in successfully");
      const redirect = searchParams.get("redirect");
      router.push(redirect || "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { email: "admin@pharma.local", role: "Super Admin", pass: "Admin@123" },
    { email: "hr@pharma.local", role: "HR", pass: "Hr@12345" },
    { email: "qa@pharma.local", role: "QA", pass: "Qa@12345" },
    { email: "dept@pharma.local", role: "Dept Head", pass: "Dept@123" },
    { email: "trainer@pharma.local", role: "Trainer", pass: "Train@123" },
    { email: "employee@pharma.local", role: "Employee", pass: "Emp@12345" },
  ];

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-700/40 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-600 font-bold">
              PL
            </div>
            <span className="text-lg font-semibold tracking-tight">PharmaLMS</span>
          </div>
          <div className="space-y-4">
            <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
              Enterprise training. Audit-ready compliance.
            </h1>
            <p className="max-w-sm text-slate-300">
              Induction, SOP version control, assessments, certificates, and complete audit trails —
              built for pharmaceutical GMP environments.
            </p>
          </div>
          <p className="text-sm text-slate-500">© 2026 PharmaLMS · SkyMap</p>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 mb-4">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold">PharmaLMS</span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Access your role-based training workspace
                {isDemo && " (Demo mode)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </CardContent>
          </Card>

          {isDemo && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Demo accounts</CardTitle>
                <CardDescription className="text-xs">Click to fill credentials</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {demoAccounts.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(a.pass);
                    }}
                    className="rounded-md border px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                  >
                    <span className="font-medium">{a.role}</span>
                    <br />
                    <span className="text-muted-foreground">{a.email}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
