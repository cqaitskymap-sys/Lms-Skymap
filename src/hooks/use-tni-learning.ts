"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getEmployeeTniLearning,
  type TniLearningProgress,
} from "@/lib/services/tni-learning";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";

const EMPTY: TniLearningProgress = {
  hasTni: false,
  items: [],
  acknowledgedCount: 0,
  allRead: false,
  acknowledgedSopIds: [],
};

export function useMyTniLearning(employeeId: string | undefined, userId: string | undefined) {
  const [progress, setProgress] = useState<TniLearningProgress>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId || !userId) {
      setProgress(EMPTY);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProgress(await getEmployeeTniLearning(employeeId, userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load TNI SOPs");
      setProgress(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [employeeId, userId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-sops-updated", onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener("pharma-sops-updated", onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
      window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    };
  }, [refresh]);

  return { progress, loading, error, refresh };
}
