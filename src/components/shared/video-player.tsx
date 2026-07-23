"use client";

interface VideoPlayerProps {
  url: string;
  title?: string;
}

export function VideoPlayer({ url, title }: VideoPlayerProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-black">
      {title && (
        <div className="bg-card px-3 py-2 text-sm font-medium text-foreground">{title}</div>
      )}
      <video controls className="aspect-video w-full" src={url} preload="metadata">
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
