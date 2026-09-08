"use client";

import Link from "next/link";
import { BookOpen, ClipboardCheck, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useMyTniLearning } from "@/hooks/use-tni-learning";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MotionItem } from "@/components/dashboard/motion";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function EmployeeDashboardPage() {
  const { profile } = useAuth();
  const employeeId = profile?.employeeId;
  const { progress, loading } = useMyTniLearning(employeeId, profile?.uid);
  const percent =
    progress.items.length === 0
      ? 0
      : Math.round((progress.acknowledgedCount / progress.items.length) * 100);

  return (
    <DashboardShell
      role="employee"
      title="My Learning"
      subtitle="Read your TNI SOPs, then take the exam"
    >
      <MotionItem>
        <GlassCard>
          <GlassCardHeader
            title="TNI SOPs"
            description="SOPs added in your Training Need Identification — acknowledge a SOP, then take its exam"
            action={
              <Button size="sm" asChild>
                <Link href={progress.acknowledgedCount > 0 ? "/dashboard/exams" : "/dashboard/sops"}>
                  {progress.acknowledgedCount > 0 ? "Take exam" : "Open SOPs"}
                </Link>
              </Button>
            }
          />
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">SOPs read</span>
              <span className="font-medium">
                {progress.acknowledgedCount}/{progress.items.length || 0}
              </span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading your SOPs…</p>
          ) : !progress.hasTni ? (
            <div className="rounded-xl border border-dashed border-white/30 bg-white/20 p-6 text-sm text-muted-foreground dark:bg-white/5">
              <GraduationCap className="mb-2 h-8 w-8 opacity-60" />
              After induction handover, your department will create your Job Description and TNI.
              SOPs added there will appear here.
            </div>
          ) : progress.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/30 bg-white/20 p-6 text-sm text-muted-foreground dark:bg-white/5">
              <BookOpen className="mb-2 h-8 w-8 opacity-60" />
              Your TNI has no SOPs yet. Department will add the SOPs you need to read.
            </div>
          ) : (
            <div className="space-y-3">
              {progress.items.map((item) => (
                <div
                  key={item.sopId}
                  className="flex flex-col gap-3 rounded-xl border border-white/20 bg-white/30 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-white/5"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{item.title}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.sopNumber}
                      </span>
                      <StatusBadge
                        status={item.acknowledged ? "passed" : "in_progress"}
                      />
                    </div>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/dashboard/sops/${item.sopId}`}>
                      {item.acknowledged ? "Review" : "Read SOP"}
                    </Link>
                  </Button>
                </div>
              ))}
              {progress.allRead ? (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  All TNI SOPs acknowledged. You can take the exams now.
                </p>
              ) : progress.acknowledgedCount > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Acknowledged SOPs have their exams unlocked. Finish the rest when you can.
                </p>
              ) : null}
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
                <p className="font-medium">SOPs</p>
                <p className="text-sm text-muted-foreground">Read every TNI SOP</p>
                <Button size="sm" variant="link" className="px-0" asChild>
                  <Link href="/dashboard/sops">Open SOPs</Link>
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
                <p className="font-medium">Exam</p>
                <p className="text-sm text-muted-foreground">Unlocks after you acknowledge the SOP</p>
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
                <p className="text-sm text-muted-foreground">Issued after you pass the exam</p>
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
