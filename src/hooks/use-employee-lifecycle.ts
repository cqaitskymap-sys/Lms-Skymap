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

  const refresh = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const data = await getEmployeeLifecycle(employeeId);
      setEmployee(data.employee);
      setEvents(data.events);
      setApprovals(data.approvals);
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

  return { employee, events, approvals, loading, refresh };
}

export function useLifecycleDirectory() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [approvals, setApprovals] = useState<LifecycleApproval[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, pending] = await Promise.all([
        listEmployeesForLifecycle(),
        listPendingApprovals(),
      ]);
      setEmployees(emps);
      setApprovals(pending);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => window.removeEventListener("pharma-lifecycle-updated", onUpdate);
  }, [refresh]);

  return { employees, approvals, loading, refresh };
}
