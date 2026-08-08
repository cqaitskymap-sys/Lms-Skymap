"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

type ExamLockState = {
  isLocked: boolean;
  attemptId: string | null;
  examTitle: string | null;
  lockExam: (args: { attemptId: string; examTitle: string }) => void;
  unlockExam: () => void;
};

const ExamLockContext = createContext<ExamLockState | null>(null);

const EXAM_ROUTE = "/dashboard/exams";
const LEAVE_MESSAGE =
  "Exam in progress — submit the assessment before leaving this page.";

export function ExamLockProvider({ children }: { children: React.ReactNode }) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState<string | null>(null);

  const lockExam = useCallback((args: { attemptId: string; examTitle: string }) => {
    setAttemptId(args.attemptId);
    setExamTitle(args.examTitle);
  }, []);

  const unlockExam = useCallback(() => {
    setAttemptId(null);
    setExamTitle(null);
  }, []);

  const value = useMemo(
    () => ({
      isLocked: !!attemptId,
      attemptId,
      examTitle,
      lockExam,
      unlockExam,
    }),
    [attemptId, examTitle, lockExam, unlockExam]
  );

  return (
    <ExamLockContext.Provider value={value}>{children}</ExamLockContext.Provider>
  );
}

export function useExamLock() {
  const ctx = useContext(ExamLockContext);
  if (!ctx) {
    throw new Error("useExamLock must be used within ExamLockProvider");
  }
  return ctx;
}

/** Optional: safe outside provider (returns unlocked defaults). */
export function useExamLockOptional(): ExamLockState {
  const ctx = useContext(ExamLockContext);
  return (
    ctx ?? {
      isLocked: false,
      attemptId: null,
      examTitle: null,
      lockExam: () => undefined,
      unlockExam: () => undefined,
    }
  );
}

/**
 * Blocks refresh/close, browser back, and in-app route changes while an exam is locked.
 * Mount once under the dashboard layout.
 */
export function ExamLockGuard() {
  const { isLocked, examTitle } = useExamLock();
  const pathname = usePathname();
  const router = useRouter();

  // Warn on tab close / refresh
  useEffect(() => {
    if (!isLocked) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = LEAVE_MESSAGE;
      return LEAVE_MESSAGE;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isLocked]);

  // Trap browser back / history
  useEffect(() => {
    if (!isLocked) return;
    const pushExam = () => {
      window.history.pushState({ examLock: true }, "", EXAM_ROUTE);
    };
    pushExam();
    const onPopState = () => {
      pushExam();
      toast.error(LEAVE_MESSAGE, {
        description: examTitle ? `Active: ${examTitle}` : undefined,
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isLocked, examTitle]);

  // If soft-nav somehow leaves /dashboard/exams, bounce back
  useEffect(() => {
    if (!isLocked) return;
    if (pathname === EXAM_ROUTE || pathname.startsWith(`${EXAM_ROUTE}/`)) return;
    toast.error(LEAVE_MESSAGE, {
      description: examTitle ? `Active: ${examTitle}` : undefined,
    });
    router.replace(EXAM_ROUTE);
  }, [isLocked, pathname, router, examTitle]);

  return null;
}
