"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { auth } from "@/lib/firebase/client";
import { changeUserPassword } from "@/lib/services/auth";
import { needsFirstLoginOnboarding } from "@/lib/services/onboarding";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/auth/schemas";
import {
  completeOnboardingProfileSchema,
  type CompleteOnboardingProfileInput,
} from "@/lib/auth/onboarding-schemas";
import { PASSWORD_POLICY_HINT } from "@/constants/auth";
import { validatePassword } from "@/lib/auth/password-policy";
import { CURRENT_POLICIES_VERSION, DEFAULT_COMPANY_POLICIES } from "@/lib/onboarding/policies";
import { ROLE_DASHBOARD_ROUTES } from "@/lib/rbac/permissions";
import { isDemoMode } from "@/lib/demo/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AiExplainInline } from "@/components/ai/ai-explain-inline";
import type { CompanyPolicy } from "@/types";

type Step = "password" | "profile" | "policies" | "done";

async function apiHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export default function FirstLoginOnboardingPage() {
  const { profile, refreshProfile, patchProfile, isDemo } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [policies, setPolicies] = useState<CompanyPolicy[]>([]);
  const [policyVersion, setPolicyVersion] = useState(CURRENT_POLICIES_VERSION);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    if (!needsFirstLoginOnboarding(profile)) {
      router.replace(ROLE_DASHBOARD_ROUTES[profile.role] || "/dashboard/employee");
      return;
    }
    if (profile.mustChangePassword) setStep("password");
    else if (profile.mustUpdateProfile) setStep("profile");
    else if (profile.mustAcceptPolicies) setStep("policies");
    else setStep("done");
  }, [profile, router]);

  const loadPolicies = useCallback(async () => {
    if (isDemo || isDemoMode()) {
      setPolicies(
        DEFAULT_COMPANY_POLICIES.map((p) => ({
          ...p,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: "system",
        }))
      );
      setPolicyVersion(CURRENT_POLICIES_VERSION);
      return;
    }
    try {
      const res = await fetch("/api/onboarding", { headers: await apiHeaders() });
      const json = await res.json();
      if (json.success) {
        setPolicies(json.data.policies);
        setPolicyVersion(json.data.version);
      }
    } catch {
      setPolicies(
        DEFAULT_COMPANY_POLICIES.map((p) => ({
          ...p,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: "system",
        }))
      );
    }
  }, [isDemo]);

  useEffect(() => {
    if (step === "policies") void loadPolicies();
  }, [step, loadPolicies]);

  const progress = useMemo(() => {
    const map: Record<Step, number> = { password: 25, profile: 50, policies: 75, done: 100 };
    return map[step];
  }, [step]);

  const finish = async () => {
    setBusy(true);
    try {
      if (isDemo || isDemoMode()) {
        patchProfile({
          mustChangePassword: false,
          mustUpdateProfile: false,
          mustAcceptPolicies: false,
          onboardingCompletedAt: new Date().toISOString(),
        });
        toast.success("Onboarding complete (demo)");
        router.replace("/dashboard/employee");
        return;
      }
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: await apiHeaders(),
        body: JSON.stringify({ step: "finish" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not finish");
      await refreshProfile();
      toast.success("Welcome aboard — onboarding complete");
      router.replace(json.data.redirect || "/dashboard/employee");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to finish");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">First-login setup</h1>
        <p className="text-muted-foreground">
          Secure your account, confirm your profile, and accept company policies before accessing
          the LMS.
        </p>
      </div>

      <Progress value={progress} className="h-2" />
      <div className="flex flex-wrap gap-2 text-xs">
        {(
          [
            ["password", "Password"],
            ["profile", "Profile"],
            ["policies", "Policies"],
            ["done", "Done"],
          ] as const
        ).map(([key, label]) => (
          <Badge key={key} variant={step === key ? "default" : "outline"}>
            {label}
          </Badge>
        ))}
      </div>

      {step === "password" && profile && (
        <PasswordStep
          email={profile.email}
          isDemo={isDemo}
          onDone={async () => {
            if (isDemo) {
              patchProfile({ mustChangePassword: false, passwordChangedAt: new Date().toISOString() });
              setStep("profile");
              return;
            }
            const fresh = await refreshProfile();
            // refreshProfile may not return — read from next tick via flags
            void fresh;
            setStep("profile");
          }}
        />
      )}

      {step === "profile" && profile && (
        <ProfileStep
          defaultName={profile.displayName}
          defaultPhone={profile.phone || ""}
          isDemo={isDemo}
          onDone={async () => {
            if (isDemo) {
              patchProfile({ mustUpdateProfile: false });
            } else {
              await refreshProfile();
            }
            setStep("policies");
          }}
        />
      )}

      {step === "policies" && (
        <PoliciesStep
          policies={policies}
          accepted={accepted}
          setAccepted={setAccepted}
          busy={busy}
          onAccept={async () => {
            const required = policies.filter((p) => p.isRequired);
            const missing = required.filter((p) => !accepted[p.id]);
            if (missing.length) {
              toast.error("Accept all required policies to continue");
              return;
            }
            setBusy(true);
            try {
              if (isDemo || isDemoMode()) {
                patchProfile({
                  mustAcceptPolicies: false,
                  policiesAcceptedAt: new Date().toISOString(),
                  policiesVersion: policyVersion,
                });
                setStep("done");
                return;
              }
              const res = await fetch("/api/onboarding", {
                method: "POST",
                headers: await apiHeaders(),
                body: JSON.stringify({
                  step: "policies",
                  data: {
                    policyIds: Object.keys(accepted).filter((id) => accepted[id]),
                    version: policyVersion,
                  },
                }),
              });
              const json = await res.json();
              if (!res.ok || !json.success) throw new Error(json.error || "Failed");
              await refreshProfile();
              setStep("done");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not save acceptance");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {step === "done" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              You&apos;re all set
            </CardTitle>
            <CardDescription>
              Continue to your employee dashboard. HR may assign induction modules next.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void finish()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Go to Employee Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PasswordStep({
  email,
  isDemo,
  onDone,
}: {
  email: string;
  isDemo: boolean;
  onDone: () => Promise<void>;
}) {
  const { profile } = useAuth();
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });
  const newPassword = watch("newPassword") || "";
  const strength = validatePassword(newPassword, { email }).strength;

  const onSubmit = async (data: ChangePasswordInput) => {
    try {
      if (isDemo) {
        toast.success("Password updated (demo)");
        await onDone();
        return;
      }
      if (!profile) return;
      await changeUserPassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        email,
        userId: profile.uid,
      });
      toast.success("Password changed");
      await onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password change failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Change temporary password
        </CardTitle>
        <CardDescription>{PASSWORD_POLICY_HINT}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {(
            [
              ["currentPassword", "Temporary password", "current"],
              ["newPassword", "New password", "next"],
              ["confirmPassword", "Confirm new password", "confirm"],
            ] as const
          ).map(([name, label, key]) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={name}>{label}</Label>
              <div className="relative">
                <Input
                  id={name}
                  type={show[key] ? "text" : "password"}
                  className="pr-10"
                  {...register(name)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                  onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
                >
                  {show[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors[name] && (
                <p className="text-xs text-destructive">{errors[name]?.message}</p>
              )}
            </div>
          ))}
          {newPassword.length > 0 && (
            <p className="text-xs text-muted-foreground">Strength: {strength}</p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save password & continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileStep({
  defaultName,
  defaultPhone,
  isDemo,
  onDone,
}: {
  defaultName: string;
  defaultPhone: string;
  isDemo: boolean;
  onDone: () => Promise<void>;
}) {
  const { patchProfile } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompleteOnboardingProfileInput>({
    resolver: zodResolver(completeOnboardingProfileSchema),
    defaultValues: {
      displayName: defaultName,
      phone: defaultPhone,
      emergencyContact: "",
      address: "",
    },
  });

  const onSubmit = async (data: CompleteOnboardingProfileInput) => {
    try {
      if (isDemo) {
        patchProfile({ displayName: data.displayName, phone: data.phone || undefined });
        toast.success("Profile updated (demo)");
        await onDone();
        return;
      }
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: await apiHeaders(),
        body: JSON.stringify({ step: "profile", data }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Update failed");
      toast.success("Profile updated");
      await onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profile update failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="h-5 w-5" />
          Confirm your profile
        </CardTitle>
        <CardDescription>Verify how your name appears on training records.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="displayName">Full name</Label>
            <Input id="displayName" {...register("displayName")} />
            {errors.displayName && (
              <p className="text-xs text-destructive">{errors.displayName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile</Label>
            <Input id="phone" {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContact">Emergency contact (optional)</Label>
            <Input id="emergencyContact" {...register("emergencyContact")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" {...register("address")} />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save profile & continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PoliciesStep({
  policies,
  accepted,
  setAccepted,
  busy,
  onAccept,
}: {
  policies: CompanyPolicy[];
  accepted: Record<string, boolean>;
  setAccepted: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  busy: boolean;
  onAccept: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Company policies
        </CardTitle>
        <CardDescription>
          Read and accept required policies. Acceptance is recorded in the audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {policies.map((p) => (
          <div key={p.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.summary}</p>
              </div>
              {p.isRequired && <Badge variant="secondary">Required</Badge>}
            </div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{p.content}</p>
            <AiExplainInline
              kind="policy"
              title={p.title}
              description={p.summary}
              content={p.content}
              buttonLabel="Explain in simple words"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id={p.id}
                checked={Boolean(accepted[p.id])}
                onCheckedChange={(c) =>
                  setAccepted((prev) => ({ ...prev, [p.id]: c === true }))
                }
              />
              <Label htmlFor={p.id} className="cursor-pointer text-sm">
                I have read and accept this policy
              </Label>
            </div>
          </div>
        ))}
        <Button onClick={() => void onAccept()} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Accept & continue
        </Button>
      </CardContent>
    </Card>
  );
}
