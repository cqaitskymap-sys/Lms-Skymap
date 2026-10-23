"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";
import { ROLE_DASHBOARD_ROUTES } from "@/lib/rbac/permissions";
import { safeInternalPath } from "@/lib/auth/safe-redirect";
import { resolveLoginIdentifier, needsFirstLoginOnboarding } from "@/lib/services/onboarding";
import {
  clearRememberedLogin,
  loadRememberedLogin,
  saveRememberedLogin,
} from "@/lib/auth/remember-login";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeveloperCredit } from "@/components/shared/developer-credit";

function LoginForm() {
  const { signIn, isDemo, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: isDemo ? "admin@pharma.local" : "",
      password: isDemo ? "Admin@123" : "",
    },
  });

  useEffect(() => {
    if (!loading && user && !isSubmitting) {
      const redirect = safeInternalPath(searchParams.get("redirect"), "/dashboard");
      router.replace(redirect);
    }
  }, [loading, user, router, searchParams, isSubmitting]);

  useEffect(() => {
    const saved = loadRememberedLogin();
    if (!saved) return;
    setRememberPassword(true);
    setValue("email", saved.identifier);
  }, [setValue]);

  const deactivated = searchParams.get("error") === "deactivated";

  const onSubmit = async (data: LoginInput) => {
    try {
      const email = await resolveLoginIdentifier(data.email);
      const profile = await signIn(email, data.password, true);
      if (rememberPassword) {
        saveRememberedLogin(data.email.trim());
      } else {
        clearRememberedLogin();
      }
      toast.success("Signed in successfully");
      if (needsFirstLoginOnboarding(profile)) {
        router.push("/dashboard/onboarding");
        return;
      }
      const redirect = safeInternalPath(searchParams.get("redirect"), "");
      if (redirect) {
        router.push(redirect);
        return;
      }
      router.push(ROLE_DASHBOARD_ROUTES[profile.role] || "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
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
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden">
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-900 lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/login-bg.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#071433]/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071433]/75 via-[#0c1c3d]/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#12306a]/35" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/skymap-logo.png"
              alt="SKYMAP"
              className="h-12 w-auto max-w-[180px] object-contain"
            />
          </div>
          <div className="space-y-4">
            <h1 className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight drop-shadow-md md:text-5xl">
              Enterprise training. Audit-ready compliance.
            </h1>
            <p className="max-w-sm text-slate-200 drop-shadow">
              Secure role-based access with session controls, login auditing, and GMP-aligned
              activity trails.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {["Live training", "Assessments", "Audit trail"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-300/80">© 2026 SKYMAP · PharmaLMS</p>
            <DeveloperCredit className="text-slate-400/90" />
          </div>
        </div>
      </div>

      <div className="dashboard-atmosphere relative flex min-h-screen w-full flex-col justify-center overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-cyan-50/50 px-6 py-12 lg:h-full lg:min-h-0 lg:w-1/2 dark:from-transparent dark:via-transparent dark:to-transparent">
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden dark:block">
          <div className="absolute left-1/2 top-[38%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/30 blur-[80px]" />
          <div className="absolute -right-10 bottom-10 h-56 w-56 rounded-full bg-violet-500/30 blur-[70px]" />
        </div>
        <div className="relative mx-auto w-full max-w-md space-y-6">

          {deactivated && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Your account has been deactivated. Contact HR.
            </div>
          )}

          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem] bg-sky-400/25 blur-3xl"
            />
            <Card className="relative overflow-hidden border-white/25 shadow-[0_30px_80px_-40px_rgba(80,140,255,0.85)]">
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
            <CardHeader className="space-y-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/skymap-logo.png"
                alt="SKYMAP"
                className="mb-2 h-11 w-auto max-w-[150px] object-contain"
              />
              <CardTitle className="font-display text-3xl font-semibold">Sign in</CardTitle>
              <CardDescription>
                Sign in with your employee code or staff ID.
                {isDemo && " (Demo mode)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">Username or email</Label>
                  <Input
                    id="email"
                    type="text"
                    autoComplete="username"
                    placeholder="EMP1001"
                    aria-invalid={!!errors.email}
                    className="h-11"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      aria-invalid={!!errors.password}
                      className="h-11 pr-10"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-password"
                    checked={rememberPassword}
                    onCheckedChange={(checked) => {
                      const on = checked === true;
                      setRememberPassword(on);
                      if (!on) clearRememberedLogin();
                    }}
                  />
                  <Label
                    htmlFor="remember-password"
                    className="cursor-pointer text-sm font-normal leading-none"
                  >
                    Remember username
                  </Label>
                </div>
                <Button type="submit" className="mt-1 h-11 w-full rounded-xl" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </CardContent>
            </Card>
          </div>

          {isDemo && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Demo accounts</CardTitle>
                <CardDescription className="text-xs">
                  Click to fill credentials · lockout after 5 failures
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {demoAccounts.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setValue("email", a.email);
                      setValue("password", a.pass);
                    }}
                    className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-left text-xs transition-all hover:border-primary/30 hover:bg-accent"
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
            <Link href="/" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground">
              ← Back to home
            </Link>
          </p>
          <DeveloperCredit className="text-center text-muted-foreground/80 lg:hidden" />
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
