"use client";

import { useCallback, useEffect, useState } from "react";
import { getSopBundle, listSopsDetailed } from "@/lib/services/sops";
import type {
  SopAcknowledgement,
  SopDocument,
  SopViewRecord,
  SopVersion,
} from "@/types";

export function useSopDirectory() {
  const [sops, setSops] = useState<(SopDocument & { version?: SopVersion })[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (filters?: Parameters<typeof listSopsDetailed>[0]) => {
    setLoading(true);
    try {
      setSops(await listSopsDetailed(filters));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-sops-updated", onUpdate);
    return () => window.removeEventListener("pharma-sops-updated", onUpdate);
  }, [refresh]);

  return { sops, loading, refresh };
}

export function useSopDetail(sopId: string | undefined) {
  const [sop, setSop] = useState<SopDocument | null>(null);
  const [versions, setVersions] = useState<SopVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<SopVersion | null>(null);
  const [views, setViews] = useState<SopViewRecord[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<SopAcknowledgement[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!sopId) return;
    setLoading(true);
    try {
      const data = await getSopBundle(sopId);
      setSop(data.sop);
      setVersions(data.versions);
      setCurrentVersion(data.currentVersion);
      setViews(data.views);
      setAcknowledgements(data.acknowledgements);
    } finally {
      setLoading(false);
    }
  }, [sopId]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("pharma-sops-updated", onUpdate);
    return () => window.removeEventListener("pharma-sops-updated", onUpdate);
  }, [refresh]);

  return {
    sop,
    versions,
    currentVersion,
    views,
    acknowledgements,
    loading,
    refresh,
  };
}
