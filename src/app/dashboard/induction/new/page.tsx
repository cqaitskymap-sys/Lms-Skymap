"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { useAuth } from "@/contexts/auth-context";
import { useInductionCatalog } from "@/hooks/use-induction";
import { useExams } from "@/hooks/use-assessment";
import {
  createInductionModule,
  uploadInductionDocument,
} from "@/lib/services/induction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  title: z.string().min(3, "Title required"),
  description: z.string().min(10, "Description required (min 10 chars)"),
  estimatedMinutes: z.coerce.number().min(1, "At least 1 minute").max(480),
  passPercentage: z.coerce.number().min(1).max(100),
});

type FormValues = z.infer<typeof schema>;

export default function NewInductionModulePage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { modules } = useInductionCatalog();
  const { exams } = useExams();
  const [isMandatory, setIsMandatory] = useState(true);
  const [assessmentId, setAssessmentId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      estimatedMinutes: 30,
      passPercentage: 80,
    },
  });

  const onSubmit = async (data: FormValues) => {
    if (!profile) return;
    setLoading(true);
    try {
      const created = await createInductionModule(
        {
          title: data.title.trim(),
          description: data.description.trim(),
          order: modules.length + 1,
          isMandatory,
          estimatedMinutes: data.estimatedMinutes,
          isActive: true,
          passPercentage: data.passPercentage,
          ...(assessmentId ? { assessmentId } : {}),
        },
        profile.uid
      );

      for (const file of files) {
        await uploadInductionDocument(
          created.id,
          file,
          file.name.replace(/\.[^.]+$/, "") || file.name,
          profile.uid
        );
      }

      toast.success(`Module “${created.title}” created`);
      router.push("/dashboard/induction");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create module");
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequirePermission permission="induction:write">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-0.5 shrink-0">
            <Link href="/dashboard/induction">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create induction module</h1>
            <p className="text-muted-foreground">
              Add to the catalog, then assign it to employees
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Module details</CardTitle>
            <CardDescription>
              Title, study time, pass mark, optional assessment & documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. GMP basics & hygiene"
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="What the employee will learn in this module"
                  {...register("description")}
                />
                {errors.description && (
                  <p className="text-xs text-destructive">{errors.description.message}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="estimatedMinutes">Estimated minutes</Label>
                  <Input
                    id="estimatedMinutes"
                    type="number"
                    min={1}
                    {...register("estimatedMinutes")}
                  />
                  {errors.estimatedMinutes && (
                    <p className="text-xs text-destructive">
                      {errors.estimatedMinutes.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passPercentage">Pass percentage</Label>
                  <Input
                    id="passPercentage"
                    type="number"
                    min={1}
                    max={100}
                    {...register("passPercentage")}
                  />
                  {errors.passPercentage && (
                    <p className="text-xs text-destructive">
                      {errors.passPercentage.message}
                    </p>
                  )}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
                <Checkbox
                  checked={isMandatory}
                  onCheckedChange={(v) => setIsMandatory(v === true)}
                />
                <div>
                  <p className="text-sm font-medium">Mandatory module</p>
                  <p className="text-xs text-muted-foreground">
                    Required for onboarding completion
                  </p>
                </div>
              </label>

              <div className="space-y-2">
                <Label>Linked assessment (optional)</Label>
                <Select
                  value={assessmentId || "none"}
                  onValueChange={(v) => setAssessmentId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No assessment yet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No assessment</SelectItem>
                    {exams.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="docs">Documents (optional)</Label>
                <Input
                  id="docs"
                  type="file"
                  multiple
                  accept=".pdf,.ppt,.pptx,video/*,application/pdf"
                  onChange={(e) =>
                    setFiles(e.target.files ? Array.from(e.target.files) : [])
                  }
                />
                {files.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {files.length} file(s) selected
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create module
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/dashboard/induction">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
