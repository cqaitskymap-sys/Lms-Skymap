"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileText, Film, Presentation, Loader2 } from "lucide-react";
import type { SopAttachment, SopVersion } from "@/types";
import { PdfViewer } from "@/components/shared/pdf-viewer";
import { VideoPlayer } from "@/components/shared/video-player";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SopMediaPreviewProps {
  version: SopVersion;
  onPreview?: () => void;
  onDownload?: (attachment: SopAttachment) => void;
  className?: string;
}

export function SopMediaPreview({
  version,
  onPreview,
  onDownload,
  className,
}: SopMediaPreviewProps) {
  const attachments = version.attachments?.length
    ? version.attachments
    : [
        {
          id: "legacy",
          type: "pdf" as const,
          title: "Document",
          fileName: "document.pdf",
          storagePath: version.storagePath,
          downloadUrl: version.downloadUrl,
          fileSize: version.fileSize,
          mimeType: version.mimeType,
          uploadedAt: version.createdAt,
          uploadedBy: version.createdBy,
        },
      ];

  const pdfs = attachments.filter((a) => a.type === "pdf");
  const videos = attachments.filter((a) => a.type === "video");
  const ppts = attachments.filter((a) => a.type === "ppt" || a.type === "other");
  const defaultTab = pdfs[0] ? "pdf" : videos[0] ? "video" : "files";

  useEffect(() => {
    onPreview?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version.id]);

  return (
    <div className={cn("space-y-3", className)}>
      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {pdfs.length > 0 && <TabsTrigger value="pdf">PDF Preview</TabsTrigger>}
          {videos.length > 0 && <TabsTrigger value="video">Video</TabsTrigger>}
          <TabsTrigger value="files">All files ({attachments.length})</TabsTrigger>
        </TabsList>

        {pdfs.length > 0 && (
          <TabsContent value="pdf" className="mt-3 space-y-3">
            {pdfs.map((pdf) => (
              <div key={pdf.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{pdf.title}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onDownload?.(pdf);
                      window.open(pdf.downloadUrl, "_blank");
                    }}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>
                <PdfViewer url={pdf.downloadUrl} title={pdf.title} />
              </div>
            ))}
          </TabsContent>
        )}

        {videos.length > 0 && (
          <TabsContent value="video" className="mt-3 space-y-3">
            {videos.map((v) => (
              <div key={v.id} className="space-y-2">
                <p className="text-sm font-medium">{v.title}</p>
                <VideoPlayer url={v.downloadUrl} title={v.title} />
              </div>
            ))}
          </TabsContent>
        )}

        <TabsContent value="files" className="mt-3 space-y-2">
          {attachments.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              onDownload={() => {
                onDownload?.(a);
                window.open(a.downloadUrl, "_blank");
              }}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AttachmentRow({
  attachment,
  onDownload,
}: {
  attachment: SopAttachment;
  onDownload: () => void;
}) {
  const Icon =
    attachment.type === "pdf"
      ? FileText
      : attachment.type === "video"
        ? Film
        : Presentation;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card/60 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{attachment.title}</p>
          <p className="text-xs text-muted-foreground">
            {attachment.type.toUpperCase()} · {formatBytes(attachment.fileSize)} ·{" "}
            {attachment.fileName}
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onDownload}>
        <Download className="mr-1 h-3.5 w-3.5" />
        Download
      </Button>
    </div>
  );
}

export function SopFileDropzone({
  files,
  onChange,
  accept = ".pdf,.ppt,.pptx,.mp4,.webm,.mov",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
}) {
  const [dragging, setDragging] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    onChange([...files, ...Array.from(list)]);
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm font-medium">Drop PDF, PPT, or Video files</p>
        <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
        <input
          type="file"
          multiple
          accept={accept}
          className="mt-3 block w-full text-sm"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-md border px-3 py-1.5"
            >
              <span className="truncate">
                {f.name}{" "}
                <span className="text-xs text-muted-foreground">({formatBytes(f.size)})</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SopLoading() {
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function ViewerBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Eye className="h-3.5 w-3.5" />
      {count} views
    </span>
  );
}
