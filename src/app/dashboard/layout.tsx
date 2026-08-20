"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppProviders } from "@/components/providers/app-providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AiTrainingChatbot } from "@/components/ai/ai-training-chatbot";
import { ExamLockGuard, useExamLockOptional } from "@/contexts/exam-lock-context";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isLocked } = useExamLockOptional();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ExamLockGuard />
      {!isLocked && (
        <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          examLocked={isLocked}
          onMenuClick={isLocked ? undefined : () => setMobileOpen(true)}
        />
        <main className="dashboard-atmosphere flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
      {!isLocked && <AiTrainingChatbot />}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <AuthGuard>
        <DashboardShell>{children}</DashboardShell>
      </AuthGuard>
    </AppProviders>
  );
}
