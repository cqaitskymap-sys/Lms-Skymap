/** Minimum dwell time so a 1–2 page SOP still requires a real read. */
export const MIN_READING_SECONDS = 60;
/** Time credited per PDF page once the document has loaded. */
export const SECONDS_PER_PAGE = 30;
/** Used when the SOP has no PDF (video / PPT only). */
export const FALLBACK_READING_SECONDS = 120;

export function requiredReadingSeconds(pageCount: number, hasPdf: boolean): number {
  if (!hasPdf) return FALLBACK_READING_SECONDS;
  if (pageCount <= 0) return MIN_READING_SECONDS;
  return Math.max(MIN_READING_SECONDS, pageCount * SECONDS_PER_PAGE);
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

export function isReadingComplete(params: {
  elapsedSeconds: number;
  requiredSeconds: number;
  allPagesViewed: boolean;
}): boolean {
  return (
    params.requiredSeconds > 0 &&
    params.elapsedSeconds >= params.requiredSeconds &&
    params.allPagesViewed
  );
}
