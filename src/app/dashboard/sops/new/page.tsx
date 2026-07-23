"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RequirePermission } from "@/components/auth/require-permission";
import { DEMO_DEPARTMENTS } from "@/lib/demo/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export default function NewSopPage() {
  const router = useRouter();
  const [depts, setDepts] = useState<string[]>([]);

  return (
    <RequirePermission permission="sops:write">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create SOP</h1>
          <p className="text-muted-foreground">Draft a new controlled document</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>SOP details</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("SOP created as draft");
                router.push("/dashboard/sops");
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>SOP number</Label>
                  <Input required placeholder="SOP-QA-004" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input required placeholder="Quality System" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea required rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Assign departments</Label>
                <div className="space-y-2">
                  {DEMO_DEPARTMENTS.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={depts.includes(d.id)}
                        onCheckedChange={(c) =>
                          setDepts((prev) =>
                            c ? [...prev, d.id] : prev.filter((x) => x !== d.id)
                          )
                        }
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Document (PDF)</Label>
                <Input type="file" accept=".pdf,.ppt,.pptx" />
              </div>
              <div className="space-y-2">
                <Label>Change summary</Label>
                <Textarea placeholder="Initial release" rows={2} />
              </div>
              <Button type="submit">Create draft</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
