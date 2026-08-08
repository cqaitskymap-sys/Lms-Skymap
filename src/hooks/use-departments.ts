"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEPARTMENTS_UPDATED_EVENT,
  listDepartments,
} from "@/lib/services/departments";
import type { Department } from "@/types";

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDepartments(await listDepartments());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load departments");
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => void refresh();
    window.addEventListener(DEPARTMENTS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(DEPARTMENTS_UPDATED_EVENT, handler);
  }, [refresh]);

  const activeDepartments = departments.filter((d) => d.isActive);

  return { departments, activeDepartments, loading, error, refresh };
}
