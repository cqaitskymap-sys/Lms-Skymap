"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  employeeCanAccessSop,
  getSopBundle,
  listSopsDetailed,
  listSopsForEmployee,
} from "@/lib/services/sops";
import type {
  SopAcknowledgement,
  SopDocument,
  SopViewRecord,
  SopVersion,
} from "@/types";

export function useSopDirectory() {
  const { profile, loading: authLoading } = useAuth();
  const [sops, setSops] = useState<(SopDocument & { version?: SopVersion })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (filters?: Parameters<typeof listSopsDetailed>[0]) => {
      if (authLoading) return;
      setLoading(true);
      setError(null);
      try {
        if (profile?.role === "employee") {
          if (!profile.employeeId) {
            setSops([]);
            setError("Your account is not linked to an employee profile");
            return;
          }
          // Employees only see SOPs assigned via Training or planned in their TNI
          setSops(
            await listSopsForEmployee(profile.employeeId, {
              status: filters?.status,
              search: filters?.search,
            })
          );
          return;
        }
        setSops(await listSopsDetailed(filters));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load SOPs");
        setSops([]);
      } finally {
        setLoading(false);
      }
    },
    [authLoading, profile?.role, profile?.employeeId]
  );

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-sops-updated", onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => {
      window.removeEventListener("pharma-sops-updated", onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
    };
  }, [refresh]);

  return { sops, loading: loading || authLoading, error, refresh };
}

export function useSopDetail(sopId: string | undefined) {
  const { profile, loading: authLoading } = useAuth();
  const [sop, setSop] = useState<SopDocument | null>(null);
  const [versions, setVersions] = useState<SopVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<SopVersion | null>(null);
  const [views, setViews] = useState<SopViewRecord[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<SopAcknowledgement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sopId || authLoading || !profile?.role) {
      if (!sopId || (!authLoading && !profile)) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (profile.role === "employee") {
        if (!profile.employeeId) {
          throw new Error("Your account is not linked to an employee profile");
        }
        const allowed = await employeeCanAccessSop(profile.employeeId, sopId);
        if (!allowed) {
          throw new Error(
            "This SOP is not assigned to you. Only SOPs from your Training / TNI are visible."
          );
        }
      }
      const data = await getSopBundle(sopId, {
        role: profile.role,
        userId: profile.uid,
      });
      setSop(data.sop);
      setVersions(data.versions);
      setCurrentVersion(data.currentVersion);
      setViews(data.views);
      setAcknowledgements(data.acknowledgements);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SOP");
      setSop(null);
      setVersions([]);
      setCurrentVersion(null);
      setViews([]);
      setAcknowledgements([]);
    } finally {
      setLoading(false);
    }
  }, [sopId, authLoading, profile]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-sops-updated", onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => {
      window.removeEventListener("pharma-sops-updated", onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
    };
  }, [refresh]);

  return {
    sop,
    versions,
    currentVersion,
    views,
    acknowledgements,
    loading,
    error,
    refresh,
  };
}
