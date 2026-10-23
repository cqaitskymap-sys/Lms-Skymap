import { doc, getDoc, setDoc } from "firebase/firestore/lite";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import { nowISO, stripUndefined } from "@/lib/services/helpers";
import { isDemoMode } from "@/lib/demo/data";
import { readSopStore, writeSopStore } from "@/lib/sops/demo-store";
import { isReadingComplete, readingProgressId, reconcileViewedPages } from "@/lib/sops/reading";
import type { SopReadingProgress } from "@/types";

const LS_PREFIX = "pharma_lms_sop_reading_";

function localKey(userId: string, versionId: string) {
  return `${LS_PREFIX}${userId}_${versionId}`;
}

function readLocalCache(userId: string, versionId: string): SopReadingProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(localKey(userId, versionId));
    return raw ? (JSON.parse(raw) as SopReadingProgress) : null;
  } catch {
    return null;
  }
}

function writeLocalCache(progress: SopReadingProgress) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(localKey(progress.userId, progress.versionId), JSON.stringify(progress));
  } catch {
    /* quota / private mode */
  }
}

function mergeProgress(
  a: SopReadingProgress | null,
  b: SopReadingProgress | null
): SopReadingProgress | null {
  if (!a) return b;
  if (!b) return a;
  const newer = (a.updatedAt || "") >= (b.updatedAt || "") ? a : b;
  const older = newer === a ? b : a;
  const newerCount = newer.pageCount || 0;
  const olderCount = older.pageCount || 0;
  // A replaced PDF must not inherit the previous document's page count or "fully read" flag.
  const documentChanged = newerCount > 0 && olderCount > 0 && newerCount !== olderCount;
  const elapsedSeconds = documentChanged
    ? newer.elapsedSeconds || 0
    : Math.max(a.elapsedSeconds || 0, b.elapsedSeconds || 0);
  const requiredSeconds = documentChanged
    ? newer.requiredSeconds || 0
    : Math.max(a.requiredSeconds || 0, b.requiredSeconds || 0);
  const pageCount = documentChanged ? newerCount : Math.max(newerCount, olderCount);
  const reachedLastPage = documentChanged
    ? Boolean(newer.reachedLastPage)
    : Boolean(a.reachedLastPage || b.reachedLastPage);
  const viewed = reconcileViewedPages({
    pageCount,
    pagesSeen: documentChanged
      ? [...(newer.pagesSeen || [])]
      : [...(a.pagesSeen || []), ...(b.pagesSeen || [])],
    reachedLastPage,
    flaggedViewed: documentChanged
      ? Boolean(newer.allPagesViewed)
      : Boolean(a.allPagesViewed || b.allPagesViewed),
  });
  const pagesSeen = viewed.pagesSeen;
  const allPagesViewed = viewed.allPagesViewed;
  const completedAt = allPagesViewed
    ? newer.completedAt || (documentChanged ? undefined : older.completedAt)
    : undefined;
  return {
    ...newer,
    elapsedSeconds,
    requiredSeconds,
    pageCount,
    pagesSeen,
    reachedLastPage,
    allPagesViewed,
    completedAt,
  };
}

export async function loadSopReadingProgress(
  userId: string,
  versionId: string
): Promise<SopReadingProgress | null> {
  const cached = readLocalCache(userId, versionId);
  const id = readingProgressId(userId, versionId);

  if (isDemoMode()) {
    const fromStore =
      readSopStore().readingProgress.find((p) => p.id === id || (p.userId === userId && p.versionId === versionId)) ||
      null;
    return mergeProgress(fromStore, cached);
  }

  try {
    const snap = await getDoc(doc(db, COLLECTIONS.sopReadingProgress, id));
    const remote = snap.exists()
      ? ({ id: snap.id, ...snap.data() } as SopReadingProgress)
      : null;
    return mergeProgress(remote, cached);
  } catch (err) {
    console.warn("[loadSopReadingProgress] remote read failed:", err);
    return cached;
  }
}

export async function saveSopReadingProgress(
  input: Omit<SopReadingProgress, "id" | "updatedAt" | "completedAt"> & {
    completedAt?: string;
  }
): Promise<SopReadingProgress> {
  const id = readingProgressId(input.userId, input.versionId);
  const cached = readLocalCache(input.userId, input.versionId);
  const now = nowISO();
  const incoming: SopReadingProgress = {
    id,
    sopId: input.sopId,
    versionId: input.versionId,
    versionNumber: input.versionNumber,
    userId: input.userId,
    elapsedSeconds: input.elapsedSeconds,
    requiredSeconds: input.requiredSeconds,
    pageCount: input.pageCount,
    pagesSeen: Array.from(new Set(input.pagesSeen)).sort((a, b) => a - b),
    reachedLastPage: input.reachedLastPage,
    allPagesViewed: input.allPagesViewed,
    completedAt: input.completedAt,
    updatedAt: now,
  };

  let stored: SopReadingProgress | null = null;
  if (isDemoMode()) {
    stored =
      readSopStore().readingProgress.find(
        (p) => p.id === id || (p.userId === input.userId && p.versionId === input.versionId)
      ) || null;
  } else {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.sopReadingProgress, id));
      stored = snap.exists() ? ({ id: snap.id, ...snap.data() } as SopReadingProgress) : null;
    } catch (err) {
      console.warn("[saveSopReadingProgress] remote read failed:", err);
    }
  }

  const merged = mergeProgress(mergeProgress(stored, cached), incoming) || incoming;
  const complete = isReadingComplete({
    elapsedSeconds: merged.elapsedSeconds,
    requiredSeconds: merged.requiredSeconds,
    allPagesViewed: merged.allPagesViewed,
  });
  const progress: SopReadingProgress = {
    ...merged,
    id,
    completedAt: merged.completedAt || (complete ? now : undefined),
    updatedAt: now,
  };

  writeLocalCache(progress);

  if (isDemoMode()) {
    const store = readSopStore();
    const idx = store.readingProgress.findIndex((p) => p.id === progress.id);
    if (idx >= 0) store.readingProgress[idx] = progress;
    else store.readingProgress.unshift(progress);
    writeSopStore(store, { silent: true });
    return progress;
  }

  try {
    await setDoc(
      doc(db, COLLECTIONS.sopReadingProgress, progress.id),
      stripUndefined(progress)
    );
  } catch (err) {
    console.warn("[saveSopReadingProgress] remote write failed:", err);
  }

  return progress;
}

export async function assertEmployeeReadingComplete(params: {
  userId: string;
  versionId: string;
}): Promise<SopReadingProgress> {
  const progress = await loadSopReadingProgress(params.userId, params.versionId);
  if (
    !progress ||
    !isReadingComplete({
      elapsedSeconds: progress.elapsedSeconds,
      requiredSeconds: progress.requiredSeconds,
      allPagesViewed: progress.allPagesViewed,
    })
  ) {
    throw new Error(
      "Finish the reading timer and scroll every page of the SOP before acknowledging"
    );
  }
  return progress;
}
