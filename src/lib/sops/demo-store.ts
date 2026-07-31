/**
 * Local SOP store — empty by default (no seeded demo records).
 */

import type {
  SopAcknowledgement,
  SopAttachment,
  SopDocument,
  SopViewRecord,
  SopVersion,
  TrainingAssignment,
} from "@/types";
import { isDemoMode } from "@/lib/demo/data";

const STORE_KEY = "pharma_lms_sops_v2";

const SAMPLE_PDF =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

export interface SopStore {
  sops: SopDocument[];
  versions: SopVersion[];
  views: SopViewRecord[];
  acknowledgements: SopAcknowledgement[];
  trainingAssignments: TrainingAssignment[];
}

function emptyStore(): SopStore {
  return {
    sops: [],
    versions: [],
    views: [],
    acknowledgements: [],
    trainingAssignments: [],
  };
}

export function readSopStore(): SopStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const store = emptyStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return store;
    }
    return JSON.parse(raw) as SopStore;
  } catch {
    return emptyStore();
  }
}

export function writeSopStore(store: SopStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("pharma-sops-updated"));
}

export function ensureSopDemoMode(): boolean {
  return isDemoMode();
}

export function fileToDemoUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(SAMPLE_PDF);
    if (file.type.startsWith("video/") || file.type.includes("pdf")) {
      reader.readAsDataURL(file);
    } else {
      resolve(SAMPLE_PDF);
    }
  });
}

export function detectAttachmentType(file: File): SopAttachment["type"] {
  if (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("video/")) return "video";
  if (
    file.type.includes("presentation") ||
    /\.pptx?$/i.test(file.name) ||
    file.type.includes("powerpoint")
  ) {
    return "ppt";
  }
  return "other";
}
