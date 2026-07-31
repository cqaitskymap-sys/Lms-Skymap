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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setModules(await listInductionModules());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return { modules, loading, refresh };
}

export function useMyInduction(employeeId: string | undefined) {
  const [items, setItems] = useState<InductionBundleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setItems(await getEmployeeInductionBundle(employeeId));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return {
    items,
    loading,
    refresh,
    progress: overallInductionProgress(items),
  };
}

export function useInductionAssignments() {
  const [assignments, setAssignments] = useState<InductionAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAssignments(await listAllInductionAssignments());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(INDUCTION_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return { assignments, loading, refresh };
}
