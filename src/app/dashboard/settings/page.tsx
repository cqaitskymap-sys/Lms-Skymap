"use client";

import { useAuth } from "@/contexts/auth-context";
import { ROLE_LABELS } from "@/lib/rbac/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SettingsPage() {
  const { profile, isDemo } = useAuth();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Profile & system preferences</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            {profile?.role ? ROLE_LABELS[profile.role] : ""} {isDemo && "· Demo mode"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input defaultValue={profile?.displayName} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue={profile?.email} disabled />
          </div>
          <div className="space-y-2">
            <Label>Digital signature (upload)</Label>
            <Input type="file" accept="image/*" />
          </div>
          <Button onClick={() => toast.success("Profile updated")}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
