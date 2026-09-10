"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadSopReadingProgress,
  saveSopReadingProgress,
} from "@/lib/services/sop-reading";
import {
  isReadingComplete,
  requiredReadingSeconds,
} from "@/lib/sops/reading";

export type SopPageProgress = {
  pagesSeen: number[];
  pageCount: number;
  reachedLastPage: boolean;
  allPagesViewed: boolean;
};

export function useSopReadingSession(params: {
  enabled: boolean;
  sopId: string;
  versionId: string;
  versionNumber: string;
  userId?: string;
  hasPdf: boolean;
}) {
  const { enabled, sopId, versionId, versionNumber, userId, hasPdf } = params;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [requiredSeconds, setRequiredSeconds] = useState(() =>
    requiredReadingSeconds(0, hasPdf)
  );
  const [pagesSeen, setPagesSeen] = useState<number[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [reachedLastPage, setReachedLastPage] = useState(false);
  const [allPagesViewed, setAllPagesViewed] = useState(!hasPdf);
  const [ready, setReady] = useState(!enabled);

  const elapsedRef = useRef(0);
  const requiredRef = useRef(requiredSeconds);
  const pagesRef = useRef<number[]>([]);
  const pageCountRef = useRef(0);
  const reachedLastRef = useRef(false);
  const allPagesRef = useRef(!hasPdf);
  const completedRef = useRef(false);

  elapsedRef.current = elapsedSeconds;
  requiredRef.current = requiredSeconds;
  pagesRef.current = pagesSeen;
  pageCountRef.current = pageCount;
  reachedLastRef.current = reachedLastPage;
  allPagesRef.current = allPagesViewed;

  const persist = useCallback(
    async (completeNow = false) => {
      if (!enabled || !userId) return;
      await saveSopReadingProgress({
        sopId,
        versionId,
        versionNumber,
        userId,
        elapsedSeconds: elapsedRef.current,
        requiredSeconds: requiredRef.current,
        pageCount: pageCountRef.current,
        pagesSeen: pagesRef.current,
        reachedLastPage: reachedLastRef.current,
        allPagesViewed: allPagesRef.current,
        completedAt: completeNow ? new Date().toISOString() : undefined,
      });
    },
    [enabled, sopId, versionId, versionNumber, userId]
  );

  useEffect(() => {
    if (!enabled || !userId) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    setElapsedSeconds(0);
    setRequiredSeconds(requiredReadingSeconds(0, hasPdf));
    setPagesSeen([]);
    setPageCount(0);
    setReachedLastPage(false);
    setAllPagesViewed(!hasPdf);
    completedRef.current = false;
    void loadSopReadingProgress(userId, versionId).then((saved) => {
      if (cancelled) return;
      if (saved) {
        setElapsedSeconds((prev) => Math.max(prev, saved.elapsedSeconds || 0));
        setRequiredSeconds((prev) =>
          Math.max(prev, saved.requiredSeconds || requiredReadingSeconds(saved.pageCount, hasPdf))
        );
        setPagesSeen((prev) =>
          Array.from(new Set([...prev, ...(saved.pagesSeen || [])])).sort((a, b) => a - b)
        );
        setPageCount((prev) => Math.max(prev, saved.pageCount || 0));
        setReachedLastPage((prev) => prev || Boolean(saved.reachedLastPage));
        setAllPagesViewed((prev) => prev || Boolean(saved.allPagesViewed) || !hasPdf);
        completedRef.current = Boolean(saved.completedAt);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, versionId, hasPdf]);

  useEffect(() => {
    if (!enabled || !userId || !ready) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (completedRef.current) return;
      if (hasPdf && pageCountRef.current <= 0) return;
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        elapsedRef.current = next;
        return next;
      });
    };

    const id = window.setInterval(tick, 1000);
    const persistId = window.setInterval(() => {
      void persist();
    }, 5000);

    const onHide = () => {
      if (document.visibilityState === "hidden") void persist();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      window.clearInterval(id);
      window.clearInterval(persistId);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
      void persist();
    };
  }, [enabled, userId, ready, hasPdf, persist]);

  const reportPages = useCallback(
    (progress: SopPageProgress) => {
      if (!enabled) return;
      const nextRequired = requiredReadingSeconds(progress.pageCount, hasPdf);
      setPageCount(progress.pageCount);
      pageCountRef.current = progress.pageCount;
      setRequiredSeconds(nextRequired);
      requiredRef.current = nextRequired;
      setPagesSeen((prev) => {
        const merged = Array.from(new Set([...prev, ...progress.pagesSeen])).sort(
          (a, b) => a - b
        );
        pagesRef.current = merged;
        return merged;
      });
      if (progress.reachedLastPage) {
        setReachedLastPage(true);
        reachedLastRef.current = true;
      }
      const viewed =
        progress.allPagesViewed ||
        (!hasPdf && progress.pageCount === 0) ||
        (progress.pageCount > 0 &&
          progress.pagesSeen.length >= progress.pageCount &&
          progress.reachedLastPage);
      if (viewed) {
        setAllPagesViewed(true);
        allPagesRef.current = true;
      }
    },
    [enabled, hasPdf]
  );

  const timerComplete = elapsedSeconds >= requiredSeconds && requiredSeconds > 0;
  const readingComplete =
    ready &&
    isReadingComplete({
      elapsedSeconds,
      requiredSeconds,
      allPagesViewed,
    });

  useEffect(() => {
    if (!enabled || !readingComplete || completedRef.current) return;
    completedRef.current = true;
    void persist(true);
  }, [enabled, readingComplete, persist]);

  return {
    ready,
    elapsedSeconds,
    requiredSeconds,
    remainingSeconds: Math.max(0, requiredSeconds - elapsedSeconds),
    pagesSeen,
    pageCount,
    reachedLastPage,
    allPagesViewed,
    timerComplete,
    readingComplete,
    reportPages,
  };
}
