"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

/** Falls back to the wordmark when the brand file is not deployed. */
export function BrandLogo({ className, alt = "SKYMAP" }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={cn("inline-flex items-center text-sm font-semibold tracking-tight", className)}>
        SKYMAP
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/skymap-logo.png"
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
