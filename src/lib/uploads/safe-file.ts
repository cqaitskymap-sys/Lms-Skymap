/** Client-side upload guards. Storage rules are the real boundary; this fails fast with a clear message. */

const BLOCKED_EXT = /\.(exe|bat|cmd|com|msi|dll|js|mjs|cjs|html?|svg|ps1|sh|jar|vbs|scr|hta)$/i;

export function sanitizeStorageFileName(name: string): string {
  const base = (name || "file").split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120);
  return cleaned || "file";
}

function extOk(file: File, pattern: RegExp): boolean {
  return pattern.test(file.name.toLowerCase());
}

/** PDF, video, Office, or a browser-supplied octet-stream with a known extension. */
export function isControlledDocument(file: File): boolean {
  const type = file.type || "";
  if (type === "application/pdf" || extOk(file, /\.pdf$/)) return true;
  if (type.startsWith("video/")) return true;
  if (/^application\/(vnd\.|msword|octet-stream)/.test(type)) return true;
  return extOk(file, /\.(pptx?|docx?|xlsx?)$/);
}

/** Controlled documents plus common raster images (not SVG). */
export function isTrainingEvidence(file: File): boolean {
  if (isControlledDocument(file)) return true;
  const type = file.type || "";
  if (/^image\/(png|jpeg|jpg|webp|gif)$/.test(type)) return true;
  return extOk(file, /\.(png|jpe?g|webp|gif)$/);
}

export function assertAllowedUpload(
  file: File,
  opts: { maxBytes: number; label: string; accept: (file: File) => boolean }
): void {
  if (!file || file.size <= 0) {
    throw new Error("Choose a non-empty file");
  }
  if (BLOCKED_EXT.test(file.name)) {
    throw new Error("This file type is not allowed");
  }
  if (file.size > opts.maxBytes) {
    const mb = Math.max(1, Math.round(opts.maxBytes / (1024 * 1024)));
    throw new Error(`${opts.label} must be ${mb} MB or smaller`);
  }
  if (!opts.accept(file)) {
    throw new Error(`This file type is not allowed for ${opts.label}`);
  }
}
