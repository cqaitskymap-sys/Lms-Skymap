/** Minimum dwell time so a 1–2 page SOP still requires a real read. */
export const MIN_READING_SECONDS = 60;
/** Time credited per PDF page once the document has loaded. */
export const SECONDS_PER_PAGE = 30;
/** Used when the SOP has no PDF (video / PPT only). */
export const FALLBACK_READING_SECONDS = 120;
/** Longest reading time the SOP author can require. */
export const MAX_READING_MINUTES = 240;

export function requiredReadingSeconds(pageCount: number, hasPdf: boolean): number {
  if (!hasPdf) return FALLBACK_READING_SECONDS;
  if (pageCount <= 0) return MIN_READING_SECONDS;
  return Math.max(MIN_READING_SECONDS, pageCount * SECONDS_PER_PAGE);
}

/** Minutes chosen by the person who added the SOP. Blank means no fixed time. */
export function parseReadingMinutes(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d+(\.\d)?$/.test(trimmed)) {
    throw new Error("Enter the reading time in minutes, like 10");
  }
  const minutes = Number(trimmed);
  if (minutes < 1 || minutes > MAX_READING_MINUTES) {
    throw new Error(`Reading time must be between 1 and ${MAX_READING_MINUTES} minutes`);
  }
  return minutes;
}

/** Seconds from the author's reading time, or null when they left it blank. */
export function fixedReadingSeconds(readingMinutes?: number): number | null {
  if (typeof readingMinutes !== "number" || !Number.isFinite(readingMinutes) || readingMinutes <= 0) {
    return null;
  }
  return Math.round(Math.min(readingMinutes, MAX_READING_MINUTES) * 60);
}

/**
 * Time the employee must stay on the SOP.
 * The author sets this. A PDF with no time set has no countdown — scrolling every page is enough.
 * Video or slides with no time set still use a short fallback.
 */
export function resolveReadingSeconds(
  readingMinutes: number | undefined,
  pageCount: number,
  hasPdf: boolean
): number {
  const fixed = fixedReadingSeconds(readingMinutes);
  if (fixed) return fixed;
  if (hasPdf) return 0;
  return requiredReadingSeconds(pageCount, false);
}

export function readingTimeLabel(readingMinutes?: number): string {
  const fixed = fixedReadingSeconds(readingMinutes);
  if (!fixed || !readingMinutes) return "Not set";
  const minutes = readingMinutes;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function readingProgressId(userId: string, versionId: string): string {
  return `${userId}__${versionId}`;
}

export function formatReadingClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Drop page numbers from a replaced PDF and only keep a viewed flag the pages still support. */
export function reconcileViewedPages(params: {
  pageCount: number;
  pagesSeen: number[];
  reachedLastPage: boolean;
  flaggedViewed?: boolean;
}): { pagesSeen: number[]; allPagesViewed: boolean } {
  const pageCount = Math.max(0, Math.floor(params.pageCount));
  const pagesSeen = Array.from(
    new Set(
      params.pagesSeen.filter(
        (page) => Number.isInteger(page) && page >= 1 && (pageCount <= 0 || page <= pageCount)
      )
    )
  ).sort((a, b) => a - b);
  const allPagesViewed =
    pageCount > 0
      ? pagesSeen.length >= pageCount && params.reachedLastPage
      : Boolean(params.flaggedViewed);
  return { pagesSeen, allPagesViewed };
}

export function isReadingComplete(params: {
  elapsedSeconds: number;
  requiredSeconds: number;
  allPagesViewed: boolean;
}): boolean {
  const timeDone =
    params.requiredSeconds <= 0 || params.elapsedSeconds >= params.requiredSeconds;
  return timeDone && params.allPagesViewed;
}
