"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { reviewDateFromEffective } from "@/lib/utils";
import type { UserRole } from "@/types";

const schema = z.object({
  sopNumber: z.string().min(3, "SOP number required"),
  versionNumber: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Enter a number like 1"),
  title: z.string().min(3, "Title required"),
  category: z.string().min(2, "Category required"),
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
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      versionNumber: "1",
      changeSummary: "Initial release",
      effectiveDate: "",
      reviewDate: "",
    },
  });
  const effectiveField = register("effectiveDate");

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
          description: "",
          category: data.category,
          versionNumber: data.versionNumber,
          departmentIds: depts,
          tags: [],
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
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link href="/dashboard/sops">
              <ArrowLeft className="mr-1 h-4 w-4" />
              All SOPs
            </Link>
          </Button>
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
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>SOP number</Label>
                  <Input placeholder="SOP-QA-004" {...register("sopNumber")} />
                  {errors.sopNumber && (
                    <p className="text-xs text-destructive">{errors.sopNumber.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Version number</Label>
                  <Input placeholder="1" {...register("versionNumber")} />
                  {errors.versionNumber && (
                    <p className="text-xs text-destructive">{errors.versionNumber.message}</p>
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
                  <Input
                    type="date"
                    {...effectiveField}
                    onChange={(e) => {
                      void effectiveField.onChange(e);
                      setValue("reviewDate", reviewDateFromEffective(e.target.value));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Review date</Label>
                  <Input type="date" {...register("reviewDate")} />
                  <p className="text-xs text-muted-foreground">
                    Fills automatically: 3 years after the effective date, one day earlier.
                  </p>
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
