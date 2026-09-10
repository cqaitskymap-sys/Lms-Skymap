"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { FileText, Loader2 } from "lucide-react";
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
  const [source, setSource] = useState<string>(url);
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(640);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef<Set<number>>(new Set());
  const lastPageRef = useRef(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setNumPages(0);
    seenRef.current = new Set();
    lastPageRef.current = false;

    const apply = (next: string) => {
      if (!cancelled) setSource(next);
    };

    if (url.startsWith("data:") || !isFirebasePath(storagePath)) {
      apply(url);
      return () => {
        cancelled = true;
      };
    }

    void getBlob(storageRef(storage, storagePath!))
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        apply(objectUrl);
      })
      .catch(() => {
        if (!cancelled) apply(url);
      });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [url, storagePath]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(320, el.clientWidth - 24));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [source]);

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || numPages <= 0 || !trackPages) return;
    const frame = window.requestAnimationFrame(() => {
      if (el.scrollHeight <= el.clientHeight + 8) {
        for (let i = 1; i <= numPages; i++) seenRef.current.add(i);
        lastPageRef.current = true;
        emit();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [numPages, trackPages, emit, width]);

  if (failed) {
    return (
      <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2 border-b bg-card px-3 py-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-primary" />
          {title || "Document Viewer"}
        </div>
        <iframe src={`${url}#toolbar=1`} title={title || "PDF"} className="h-full w-full min-h-[480px]" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-lg border bg-muted/30">
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
        <Document
          file={source}
          loading=""
          onLoadSuccess={({ numPages: count }) => {
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
            setFailed(true);
            setLoading(false);
            if (trackPages) {
              onPagesProgress?.({
                pageCount: 1,
                pagesSeen: [1],
                reachedLastPage: true,
                allPagesViewed: true,
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
            />
          ))}
        </Document>
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
}: {
  pageNumber: number;
  last: boolean;
  width: number;
  root: RefObject<HTMLDivElement | null>;
  onVisible: (page: number) => void;
  onBottomVisible: () => void;
}) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootEl = root.current;
    if (!rootEl) return;
    const nodes = [topRef.current, bottomRef.current].filter(Boolean) as HTMLDivElement[];
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
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
  }, [root, pageNumber, last, onVisible, onBottomVisible, width]);

  return (
    <div className={cn("relative w-full max-w-full shadow-sm")}>
      <div ref={topRef} className="h-1 w-full" />
      <Page
        pageNumber={pageNumber}
        width={width}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        className="overflow-hidden rounded-sm bg-white"
      />
      <div ref={bottomRef} className="h-1 w-full" />
    </div>
  );
}
