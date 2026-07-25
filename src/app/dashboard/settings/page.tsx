"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Shield } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ROLE_LABELS } from "@/lib/rbac/permissions";
import {
  changePasswordSchema,
  profileUpdateSchema,
  type ChangePasswordInput,
  type ProfileUpdateInput,
} from "@/lib/auth/schemas";
import { PASSWORD_POLICY_HINT } from "@/constants/auth";
import { changeUserPassword, updateUserProfile } from "@/lib/services/auth";
import { validatePassword } from "@/lib/auth/password-policy";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

function ProfileTab() {
  const { profile, isDemo, patchProfile, refreshProfile } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      displayName: profile?.displayName ?? "",
      phone: profile?.phone ?? "",
    },
  });

  useEffect(() => {
    reset({
      displayName: profile?.displayName ?? "",
      phone: profile?.phone ?? "",
    });
  }, [profile, reset]);

  const onSubmit = async (data: ProfileUpdateInput) => {
    if (!profile) return;
    try {
      if (isDemo) {
        patchProfile({
          displayName: data.displayName,
          phone: data.phone || undefined,
          updatedAt: new Date().toISOString(),
        });
        toast.success("Profile updated (demo)");
        return;
      }
      await updateUserProfile({
        userId: profile.uid,
        displayName: data.displayName,
        phone: data.phone,
      });
      await refreshProfile();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          {profile?.role ? ROLE_LABELS[profile.role] : ""}
          {isDemo && " · Demo mode"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" {...register("displayName")} />
            {errors.displayName && (
              <p className="text-xs text-destructive">{errors.displayName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" placeholder="+91 …" {...register("phone")} />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>Last login: {formatDateTime(profile?.lastLoginAt)}</span>
            {profile?.isActive === false && <Badge variant="destructive">Inactive</Badge>}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordTab() {
  const { profile, isDemo } = useAuth();
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const newPassword = watch("newPassword") || "";
  const strength = validatePassword(newPassword, { email: profile?.email }).strength;

  const onSubmit = async (data: ChangePasswordInput) => {
    if (!profile) return;
    try {
      await changeUserPassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        email: profile.email,
        userId: profile.uid,
      });
      reset();
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>{PASSWORD_POLICY_HINT}</CardDescription>
      </CardHeader>
      <CardContent>
        {isDemo ? (
          <p className="text-sm text-muted-foreground">
            Password change is disabled in demo mode. Use Firebase Auth in a configured environment.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {(
              [
                ["currentPassword", "Current password", "current"],
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
                    autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
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
              <div className="flex items-center gap-2 text-xs">
                <Shield className="h-3.5 w-3.5" />
                Strength:{" "}
                <Badge
                  variant={
                    strength === "strong" ? "default" : strength === "fair" ? "secondary" : "outline"
                  }
                >
                  {strength}
                </Badge>
              </div>
            )}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function SessionTab() {
  const { profile, signOut, isDemo } = useAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session</CardTitle>
        <CardDescription>
          Idle sessions expire after 30 minutes. Tokens refresh automatically while you are active.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="font-mono text-xs">{profile?.uid}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd>{profile?.role ? ROLE_LABELS[profile.role] : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last login</dt>
            <dd>{formatDateTime(profile?.lastLoginAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mode</dt>
            <dd>{isDemo ? "Demo" : "Firebase Auth"}</dd>
          </div>
        </dl>
        <Button variant="destructive" onClick={() => signOut()}>
          Sign out everywhere (this browser)
        </Button>
      </CardContent>
    </Card>
  );
}

function SettingsTabs() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "password" ? "password" : "profile";
  const required = searchParams.get("reason") === "required";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Profile, password & session</p>
      </div>

      {required && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          You must change your password before continuing.
        </div>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="session">Session</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="password" className="mt-4">
          <PasswordTab />
        </TabsContent>
        <TabsContent value="session" className="mt-4">
          <SessionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <SettingsTabs />
    </Suspense>
  );
}
