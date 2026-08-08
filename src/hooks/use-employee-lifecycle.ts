"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getEmployeeLifecycle,
  listEmployeesForLifecycle,
  listPendingApprovals,
} from "@/lib/services/lifecycle";
import type { Employee, LifecycleApproval, LifecycleEvent } from "@/types";

/** Subscribe to demo store updates + initial fetch for lifecycle data. */
export function useEmployeeLifecycle(employeeId: string | undefined) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [approvals, setApprovals] = useState<LifecycleApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getEmployeeLifecycle(employeeId);
      setEmployee(data.employee);
      setEvents(data.events);
      setApprovals(data.approvals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employee");
      setEmployee(null);
      setEvents([]);
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => window.removeEventListener("pharma-lifecycle-updated", onUpdate);
  }, [refresh]);

  return { employee, events, approvals, loading, error, refresh };
}

export function useLifecycleDirectory(options?: { includeApprovals?: boolean }) {
  const includeApprovals = options?.includeApprovals ?? false;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [approvals, setApprovals] = useState<LifecycleApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (includeApprovals) {
        const [emps, pending] = await Promise.all([
          listEmployeesForLifecycle(),
          listPendingApprovals(),
        ]);
        setEmployees(emps);
        setApprovals(pending);
      } else {
        const emps = await listEmployeesForLifecycle();
        setEmployees(emps);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
      setEmployees([]);
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [includeApprovals]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => window.removeEventListener("pharma-lifecycle-updated", onUpdate);
  }, [refresh]);

  return { employees, approvals, loading, error, refresh };
}
