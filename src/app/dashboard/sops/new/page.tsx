"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { useDepartments } from "@/hooks/use-departments";
import { useAuth } from "@/contexts/auth-context";
import { createSopWithFiles, type SopActor } from "@/lib/services/sops";
import { SopFileDropzone } from "@/components/sops/sop-media-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserRole } from "@/types";

const schema = z.object({
  sopNumber: z.string().min(3, "SOP number required"),
  title: z.string().min(3, "Title required"),
  description: z.string().min(10, "Description required"),
  category: z.string().min(2, "Category required"),
  tags: z.string().optional(),
  changeSummary: z.string().optional(),
  effectiveDate: z.string().optional(),
  reviewDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewSopPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { activeDepartments } = useDepartments();
  const [depts, setDepts] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      changeSummary: "Initial release",
      reviewDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    },
  });

  const actor: SopActor | null = useMemo(() => {
    if (!profile) return null;
    return {
      uid: profile.uid,
      name: profile.displayName,
      email: profile.email,
      role: profile.role as UserRole,
      employeeId: profile.employeeId,
    };
  }, [profile]);

  const onSubmit = async (data: FormValues) => {
    if (!actor) return;
    if (!depts.length) {
      toast.error("Select at least one department");
      return;
    }
    if (!files.length) {
      toast.error("Upload at least one PDF, PPT, or video");
      return;
    }
    setLoading(true);
    try {
      const { sop } = await createSopWithFiles(
        {
          sopNumber: data.sopNumber,
          title: data.title,
          description: data.description,
          category: data.category,
          departmentIds: depts,
          tags: (data.tags || "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          changeSummary: data.changeSummary || "Initial release",
          effectiveDate: data.effectiveDate
            ? new Date(data.effectiveDate).toISOString()
            : undefined,
          reviewDate: data.reviewDate
            ? new Date(data.reviewDate).toISOString()
            : undefined,
          files,
        },
        actor
      );
      toast.success(`SOP ${sop.sopNumber} created as draft`);
      router.push(`/dashboard/sops/${sop.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create SOP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequirePermission permission="sops:write">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create SOP</h1>
          <p className="text-muted-foreground">
            Upload PDF, PPT, and video · draft → review → approve
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>SOP details</CardTitle>
            <CardDescription>
              Department mapping, effective/review dates, and multi-file upload
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>SOP number</Label>
                  <Input placeholder="SOP-QA-004" {...register("sopNumber")} />
                  {errors.sopNumber && (
                    <p className="text-xs text-destructive">{errors.sopNumber.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input placeholder="Quality System" {...register("category")} />
                  {errors.category && (
                    <p className="text-xs text-destructive">{errors.category.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input {...register("title")} />
                {errors.title && (
                  <p className="text-xs text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea rows={3} {...register("description")} />
                {errors.description && (
                  <p className="text-xs text-destructive">{errors.description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input placeholder="gmp, deviation, capa" {...register("tags")} />
              </div>

              <div className="space-y-2">
                <Label>Assign departments</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeDepartments.map((d) => (
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
                {!activeDepartments.length && (
                  <p className="text-xs text-muted-foreground">
                    No departments found. Seed them from the Departments page.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Effective date (optional until approve)</Label>
                  <Input type="date" {...register("effectiveDate")} />
                </div>
                <div className="space-y-2">
                  <Label>Review date</Label>
                  <Input type="date" {...register("reviewDate")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Change summary</Label>
                <Textarea rows={2} {...register("changeSummary")} />
              </div>

              <div className="space-y-2">
                <Label>Documents (PDF / PPT / Video)</Label>
                <SopFileDropzone files={files} onChange={setFiles} />
              </div>

              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create draft
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
