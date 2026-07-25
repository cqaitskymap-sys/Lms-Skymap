"use client";

import Link from "next/link";
import { BookOpen, ClipboardCheck, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useMyInduction } from "@/hooks/use-induction";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function EmployeeDashboardPage() {
  const { profile } = useAuth();
  const employeeId = profile?.employeeId;
  const { items, loading, progress } = useMyInduction(employeeId);

  return (
    <DashboardShell
      role="employee"
      title="My Learning"
      subtitle="Induction, trainings, exams & certificates"
    >
      <MotionItem>
        <GlassCard>
          <GlassCardHeader
            title="Onboarding checklist"
            description="Complete induction modules assigned by HR"
            action={
              <Button size="sm" asChild>
                <Link href="/dashboard/induction">Open induction</Link>
              </Button>
            }
          />
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Induction progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading assignments…</p>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/30 bg-white/20 p-6 text-sm text-muted-foreground dark:bg-white/5">
              <GraduationCap className="mb-2 h-8 w-8 opacity-60" />
              No induction modules yet. HR will assign your onboarding modules after verification.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.assignment.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/20 bg-white/30 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-white/5"
                >
                  <div className="min-w-0 space-y-2">
                    <p className="font-medium">{item.module.title}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.assignment.status} />
                      <span className="text-xs text-muted-foreground">
                        {item.assignment.progressPercent ?? 0}% complete
                      </span>
                    </div>
                    <Progress
                      value={item.assignment.progressPercent ?? 0}
                      className="h-1.5 w-full max-w-xs"
                    />
                  </div>
                  <Button size="sm" asChild>
                    <Link href="/dashboard/induction">
                      {item.assignment.status === "assessment_pending"
                        ? "Take assessment"
                        : "Continue"}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </MotionItem>

      <div className="grid gap-4 sm:grid-cols-3">
        <MotionItem>
          <GlassCard className="h-full">
            <div className="flex items-start gap-3 p-1">
              <BookOpen className="mt-0.5 h-5 w-5 text-cyan-700" />
              <div>
                <p className="font-medium">Training</p>
                <p className="text-sm text-muted-foreground">SOP assignments after handover</p>
                <Button size="sm" variant="link" className="px-0" asChild>
                  <Link href="/dashboard/training">View training</Link>
                </Button>
              </div>
            </div>
          </GlassCard>
        </MotionItem>
        <MotionItem>
          <GlassCard className="h-full">
            <div className="flex items-start gap-3 p-1">
              <ClipboardCheck className="mt-0.5 h-5 w-5 text-cyan-700" />
              <div>
                <p className="font-medium">Assessments</p>
                <p className="text-sm text-muted-foreground">Exams linked to your modules</p>
                <Button size="sm" variant="link" className="px-0" asChild>
                  <Link href="/dashboard/exams">Open exams</Link>
                </Button>
              </div>
            </div>
          </GlassCard>
        </MotionItem>
        <MotionItem>
          <GlassCard className="h-full">
            <div className="flex items-start gap-3 p-1">
              <GraduationCap className="mt-0.5 h-5 w-5 text-cyan-700" />
              <div>
                <p className="font-medium">Certificates</p>
                <p className="text-sm text-muted-foreground">Issued after you pass assessments</p>
                <Button size="sm" variant="link" className="px-0" asChild>
                  <Link href="/dashboard/certificates">My certificates</Link>
                </Button>
              </div>
            </div>
          </GlassCard>
        </MotionItem>
      </div>
    </DashboardShell>
  );
}
