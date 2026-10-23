"use client";

import { Suspense, useState } from "react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppProviders } from "@/components/providers/app-providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ExamLockGuard, useExamLockOptional } from "@/contexts/exam-lock-context";

const AiTrainingChatbot = dynamic(
  () => import("@/components/ai/ai-training-chatbot").then((m) => m.AiTrainingChatbot),
  { ssr: false }
);

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isLocked } = useExamLockOptional();

  return (
    <div className="dashboard-atmosphere relative flex h-screen overflow-hidden">
      <ExamLockGuard />
      {!isLocked && (
        <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      )}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          examLocked={isLocked}
          onMenuClick={isLocked ? undefined : () => setMobileOpen(true)}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-5 md:py-5">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-24 animate-fade-in">{children}</div>
        </main>
      </div>
      {!isLocked && <AiTrainingChatbot />}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <AuthGuard>
          <DashboardShell>{children}</DashboardShell>
        </AuthGuard>
      </Suspense>
    </AppProviders>
  );
}
