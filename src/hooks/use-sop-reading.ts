"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadSopReadingProgress,
  saveSopReadingProgress,
} from "@/lib/services/sop-reading";
import {
  fixedReadingSeconds,
  isReadingComplete,
  reconcileViewedPages,
  resolveReadingSeconds,
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
  /** Minutes set by the person who added this SOP. */
  readingMinutes?: number;
}) {
  const { enabled, sopId, versionId, versionNumber, userId, hasPdf, readingMinutes } = params;
  const readingMinutesRef = useRef(readingMinutes);
  readingMinutesRef.current = readingMinutes;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [requiredSeconds, setRequiredSeconds] = useState(() =>
    resolveReadingSeconds(readingMinutes, 0, hasPdf)
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
        fixedReadingTime: fixedReadingSeconds(readingMinutesRef.current) != null ? true : false,
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
    setRequiredSeconds(resolveReadingSeconds(readingMinutesRef.current, 0, hasPdf));
    setPagesSeen([]);
    setPageCount(0);
    setReachedLastPage(false);
    setAllPagesViewed(!hasPdf);
    completedRef.current = false;
    void loadSopReadingProgress(userId, versionId).then((saved) => {
      if (cancelled) return;
      if (saved) {
        const liveCount = pageCountRef.current;
        const savedCount = saved.pageCount || 0;
        const liveDocumentDiffers =
          liveCount > 0 && savedCount > 0 && liveCount !== savedCount;
        if (!liveDocumentDiffers) {
          setElapsedSeconds((prev) => Math.max(prev, saved.elapsedSeconds || 0));
          setRequiredSeconds(
            resolveReadingSeconds(readingMinutesRef.current, saved.pageCount, hasPdf)
          );
          const savedViewed =
            !hasPdf ||
            (savedCount > 0 &&
              (saved.pagesSeen || []).filter((page) => page >= 1 && page <= savedCount).length >=
                savedCount &&
              Boolean(saved.reachedLastPage));
          setPagesSeen((prev) =>
            Array.from(
              new Set(
                [...prev, ...(saved.pagesSeen || [])].filter(
                  (page) => savedCount <= 0 || page <= savedCount
                )
              )
            ).sort((a, b) => a - b)
          );
          setPageCount((prev) => Math.max(prev, savedCount));
          setReachedLastPage((prev) => prev || Boolean(saved.reachedLastPage));
          setAllPagesViewed((prev) => prev || savedViewed);
          completedRef.current = Boolean(saved.completedAt) && savedViewed;
        }
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, versionId, hasPdf]);

  useEffect(() => {
    const next = resolveReadingSeconds(readingMinutes, pageCountRef.current, hasPdf);
    requiredRef.current = next;
    setRequiredSeconds(next);
  }, [readingMinutes, hasPdf]);

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
      // A failed PDF load reports 0 pages. Ignore it so a short timer or a
      // frozen clock does not unlock or block acknowledgement by accident.
      if (hasPdf && progress.pageCount <= 0) return;

      const nextRequired = resolveReadingSeconds(
        readingMinutesRef.current,
        progress.pageCount,
        hasPdf
      );
      const previousCount = pageCountRef.current;
      const documentChanged =
        previousCount > 0 &&
        progress.pageCount > 0 &&
        progress.pageCount !== previousCount;
      const grew = !documentChanged && previousCount > 0 && progress.pageCount > previousCount;
      const reached = documentChanged
        ? progress.reachedLastPage
        : grew
          ? progress.reachedLastPage
          : progress.reachedLastPage || reachedLastRef.current;
      const merged = documentChanged
        ? [...progress.pagesSeen]
        : Array.from(new Set([...pagesRef.current, ...progress.pagesSeen])).sort((a, b) => a - b);
      const reconciled = reconcileViewedPages({
        pageCount: progress.pageCount,
        pagesSeen: merged,
        reachedLastPage: reached,
        flaggedViewed: !hasPdf && !documentChanged,
      });
      if (documentChanged) {
        elapsedRef.current = 0;
        setElapsedSeconds(0);
        completedRef.current = false;
      }

      pageCountRef.current = progress.pageCount;
      requiredRef.current = nextRequired;
      pagesRef.current = reconciled.pagesSeen;
      reachedLastRef.current = reached;
      allPagesRef.current = reconciled.allPagesViewed;
      setPageCount(progress.pageCount);
      setRequiredSeconds(nextRequired);
      setPagesSeen(reconciled.pagesSeen);
      setReachedLastPage(reached);
      setAllPagesViewed(reconciled.allPagesViewed);
    },
    [enabled, hasPdf]
  );

  const timerComplete = requiredSeconds <= 0 || elapsedSeconds >= requiredSeconds;
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
