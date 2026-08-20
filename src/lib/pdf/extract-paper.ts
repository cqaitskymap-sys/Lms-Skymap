"use client";

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_PAGES = 25;
const TEXT_THRESHOLD = 400;
const MAX_VISION_PAGES = 6;

export type ExtractedPaper = {
  fileName: string;
  text: string;
  pageCount: number;
  images: string[];
  scannedFallback: boolean;
};

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

function pageText(items: Array<{ str?: string }>): string {
  return items
    .map((item) => (typeof item.str === "string" ? item.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractQuestionPaper(file: File): Promise<ExtractedPaper> {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("Please upload a PDF question paper");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("PDF is too large (max 12 MB)");
  }

  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = doc.numPages;
  const pagesToRead = Math.min(pageCount, MAX_PAGES);

  const chunks: string[] = [];
  for (let i = 1; i <= pagesToRead; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = pageText(content.items as Array<{ str?: string }>);
    if (text) chunks.push(`--- Page ${i} ---\n${text}`);
  }

  const text = chunks.join("\n\n").slice(0, 40_000);
  const scannedFallback = text.replace(/\s/g, "").length < TEXT_THRESHOLD;
  const images: string[] = [];

  if (scannedFallback) {
    const visionPages = Math.min(pageCount, MAX_VISION_PAGES);
    for (let i = 1; i <= visionPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.15 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.68));
    }
  }

  if (!text && images.length === 0) {
    throw new Error("Could not read any text or pages from this PDF");
  }

  return {
    fileName: file.name,
    text,
    pageCount,
    images,
    scannedFallback,
  };
}
