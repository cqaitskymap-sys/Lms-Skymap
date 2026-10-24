"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { FileText, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Document, Page, pdfjs } from "react-pdf";
import { getBlob, ref as storageRef } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import type { SopPageProgress } from "@/hooks/use-sop-reading";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type SopPdfReaderProps = {
  url: string;
  storagePath?: string;
  title?: string;
  trackPages?: boolean;
  onPagesProgress?: (progress: SopPageProgress) => void;
};

function isFirebasePath(path?: string) {
  return Boolean(path && !path.startsWith("demo/") && !path.startsWith("http") && !path.startsWith("data:"));
}

export function SopPdfReader({
  url,
  storagePath,
  title,
  trackPages = false,
  onPagesProgress,
}: SopPdfReaderProps) {
  const [file, setFile] = useState<Blob | string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(640);
  const [aspect, setAspect] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [renderedCount, setRenderedCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<Set<number>>(new Set());
  const seenRef = useRef<Set<number>>(new Set());
  const lastPageRef = useRef(false);
  const loadIdRef = useRef(0);
  const fileLoadIdRef = useRef(0);
  const onPagesProgressRef = useRef(onPagesProgress);
  onPagesProgressRef.current = onPagesProgress;

  useEffect(() => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setFailed(false);
    setFile(null);
    setNumPages(0);
    setAspect(null);
    setRenderedCount(0);
    seenRef.current = new Set();
    renderedRef.current = new Set();
    lastPageRef.current = false;

    const stillCurrent = () => loadId === loadIdRef.current;

    const commit = (next: Blob | string) => {
      if (!stillCurrent()) return;
      fileLoadIdRef.current = loadId;
      setFile(next);
      setFailed(false);
    };

    const giveUp = () => {
      if (!stillCurrent()) return;
      setFailed(true);
      setLoading(false);
      if (trackPages) {
        onPagesProgressRef.current?.({
          pageCount: 0,
          pagesSeen: [],
          reachedLastPage: false,
          allPagesViewed: false,
        });
      }
    };

    const load = async () => {
      if (!url) {
        giveUp();
        return;
      }

      if (url.startsWith("data:")) {
        commit(url);
        return;
      }

      if (isFirebasePath(storagePath)) {
        try {
          const blob = await getBlob(storageRef(storage, storagePath!));
          if (!stillCurrent()) return;
          commit(blob);
          return;
        } catch {
          // Download URL is the fallback when the Storage SDK request fails.
        }
      }

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (!stillCurrent()) return;
        commit(blob);
      } catch {
        if (!isFirebasePath(storagePath) && url) {
          commit(url);
          return;
        }
        giveUp();
      }
    };

    void load();
    return () => {
      loadIdRef.current += 1;
    };
  }, [url, storagePath, trackPages, reloadToken]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const boxW = Math.max(320, el.clientWidth - 24);
      const boxH = Math.max(360, el.clientHeight - 16);
      const next = aspect && aspect > 0 ? Math.min(boxW, boxH / aspect) : boxW;
      setWidth(Math.max(280, Math.floor(next)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [file, aspect]);

  const emit = useCallback(() => {
    if (!trackPages || !onPagesProgress || numPages <= 0) return;
    const pagesSeen = Array.from(seenRef.current).sort((a, b) => a - b);
    onPagesProgress({
      pagesSeen,
      pageCount: numPages,
      reachedLastPage: lastPageRef.current,
      allPagesViewed: pagesSeen.length >= numPages && lastPageRef.current,
    });
  }, [trackPages, onPagesProgress, numPages]);

  const markPage = useCallback(
    (pageNumber: number) => {
      if (!trackPages) return;
      if (seenRef.current.has(pageNumber)) return;
      seenRef.current.add(pageNumber);
      emit();
    },
    [trackPages, emit]
  );

  const markLastPage = useCallback(() => {
    if (!trackPages) return;
    lastPageRef.current = true;
    emit();
  }, [trackPages, emit]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || !trackPages || numPages <= 0) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
      lastPageRef.current = true;
      seenRef.current.add(numPages);
      emit();
    }
  };

  const markRendered = useCallback((pageNumber: number) => {
    if (renderedRef.current.has(pageNumber)) return;
    renderedRef.current.add(pageNumber);
    setRenderedCount(renderedRef.current.size);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || numPages <= 0 || !trackPages || renderedCount < numPages) return;
    const frame = window.requestAnimationFrame(() => {
      const pages = el.querySelectorAll<HTMLElement>("[data-sop-page]");
      if (pages.length < numPages) return;
      const laidOut = Array.from(pages).every((page) => page.offsetHeight >= 80);
      if (!laidOut) return;
      if (el.scrollHeight <= el.clientHeight + 8) {
        for (let i = 1; i <= numPages; i++) seenRef.current.add(i);
        lastPageRef.current = true;
        emit();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [numPages, trackPages, emit, width, renderedCount]);

  if (failed) {
    return (
      <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2 border-b bg-card px-3 py-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-primary" />
          {title || "Document Viewer"}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {trackPages
              ? "This preview cannot track pages, so acknowledgement stays locked until the document loads in the reader."
              : "The document viewer could not open this file."}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => setReloadToken((n) => n + 1)}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
        <iframe src={`${url}#toolbar=1`} title={title || "PDF"} className="h-full w-full min-h-[480px]" />
      </div>
    );
  }

  return (
    <div className="flex h-[min(78vh,920px)] min-h-[520px] flex-col overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          {title || "Document Viewer"}
        </span>
        {numPages > 0 && (
          <span className="text-xs font-normal text-muted-foreground">
            {numPages} page{numPages === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900"
        onScroll={onScroll}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {file && (
        <Document
          file={file}
          loading=""
          onLoadSuccess={({ numPages: count }) => {
            if (fileLoadIdRef.current !== loadIdRef.current) return;
            setNumPages(count);
            setLoading(false);
            if (trackPages) {
              onPagesProgress?.({
                pagesSeen: Array.from(seenRef.current),
                pageCount: count,
                reachedLastPage: false,
                allPagesViewed: false,
              });
            }
          }}
          onLoadError={() => {
            if (fileLoadIdRef.current !== loadIdRef.current) return;
            setFailed(true);
            setLoading(false);
            if (trackPages) {
              onPagesProgress?.({
                pageCount: 0,
                pagesSeen: [],
                reachedLastPage: false,
                allPagesViewed: false,
              });
            }
          }}
          className="flex flex-col items-center gap-3 px-3 py-3"
        >
          {Array.from({ length: numPages }, (_, i) => (
            <TrackedPage
              key={`page-${i + 1}`}
              pageNumber={i + 1}
              last={i + 1 === numPages}
              width={width}
              root={scrollRef}
              onVisible={markPage}
              onBottomVisible={markLastPage}
              onRendered={markRendered}
              onMetrics={
                i === 0
                  ? (ratio) => setAspect((current) => current ?? ratio)
                  : undefined
              }
            />
          ))}
        </Document>
        )}
      </div>
    </div>
  );
}

function TrackedPage({
  pageNumber,
  last,
  width,
  root,
  onVisible,
  onBottomVisible,
  onRendered,
  onMetrics,
}: {
  pageNumber: number;
  last: boolean;
  width: number;
  root: RefObject<HTMLDivElement | null>;
  onVisible: (page: number) => void;
  onBottomVisible: () => void;
  onRendered?: (page: number) => void;
  onMetrics?: (heightOverWidth: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [laidOut, setLaidOut] = useState(false);

  useEffect(() => {
    if (!laidOut) return;
    const rootEl = root.current;
    const box = boxRef.current;
    if (!rootEl || !box || box.offsetHeight < 80) return;
    const nodes = [topRef.current, bottomRef.current].filter(Boolean) as HTMLDivElement[];
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (box.offsetHeight < 80) return;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === topRef.current) onVisible(pageNumber);
          if (entry.target === bottomRef.current && last) onBottomVisible();
        }
      },
      { root: rootEl, threshold: 0.01 }
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [laidOut, root, pageNumber, last, onVisible, onBottomVisible, width]);

  return (
    <div ref={boxRef} data-sop-page={pageNumber} className={cn("relative w-fit max-w-full shadow-sm")}>
      <div ref={topRef} className="h-1 w-full" />
      <Page
        pageNumber={pageNumber}
        width={width}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        onLoadSuccess={(page) => {
          const viewport = page.getViewport({ scale: 1 });
          if (viewport.width > 0) onMetrics?.(viewport.height / viewport.width);
        }}
        onRenderSuccess={() => {
          onRendered?.(pageNumber);
          window.requestAnimationFrame(() => {
            if ((boxRef.current?.offsetHeight ?? 0) >= 80) setLaidOut(true);
          });
        }}
        className="overflow-hidden rounded-sm bg-white"
      />
      <div ref={bottomRef} className="h-1 w-full" />
    </div>
  );
}
