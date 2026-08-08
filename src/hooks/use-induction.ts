"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getEmployeeInductionBundle,
  listAllInductionAssignments,
  listInductionModules,
  overallInductionProgress,
  type InductionBundleItem,
} from "@/lib/services/induction";
import { INDUCTION_UPDATED_EVENT } from "@/lib/induction/demo-store";
import type { InductionAssignment, InductionModule } from "@/types";

export function useInductionCatalog() {
  const [modules, setModules] = useState<InductionModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setModules(await listInductionModules());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog");
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => {
      window.removeEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
    };
  }, [refresh]);

  return { modules, loading, error, refresh };
}

export function useMyInduction(employeeId: string | undefined) {
  const [items, setItems] = useState<InductionBundleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await getEmployeeInductionBundle(employeeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load induction");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => {
      window.removeEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
    };
  }, [refresh]);

  return {
    items,
    loading,
    error,
    refresh,
    progress: overallInductionProgress(items),
  };
}

export function useInductionAssignments(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled !== false;
  const [assignments, setAssignments] = useState<InductionAssignment[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setAssignments([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAssignments(await listAllInductionAssignments());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments");
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const onUpdate = () => void refresh();
    window.addEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => {
      window.removeEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
    };
  }, [refresh, enabled]);

  return { assignments, loading, error, refresh };
}
