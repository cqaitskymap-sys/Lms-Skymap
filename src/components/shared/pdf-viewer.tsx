"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

interface PdfViewerProps {
  url: string;
  title?: string;
}

export function PdfViewer({ url, title }: PdfViewerProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [url]);

  return (
    <div className="flex h-[75vh] min-h-[640px] w-full flex-col overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2 text-sm font-medium">
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">{title || "Document Viewer"}</span>
      </div>
      <div className="relative min-h-0 flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <iframe
          src={`${url}#toolbar=1&zoom=page-fit`}
          title={title || "PDF"}
          className="absolute inset-0 h-full w-full"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
