"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { ExamLockProvider } from "@/contexts/exam-lock-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ExamLockProvider>{children}</ExamLockProvider>
    </AuthProvider>
  );
}
