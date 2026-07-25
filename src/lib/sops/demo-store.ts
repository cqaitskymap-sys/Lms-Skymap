/**
 * Demo-mode SOP store — full version control, views, acknowledgements offline.
 */

import type {
  SopAcknowledgement,
  SopAttachment,
  SopDocument,
  SopViewRecord,
  SopVersion,
  TrainingAssignment,
} from "@/types";
import { DEMO_SOPS, DEMO_ASSIGNMENTS, isDemoMode } from "@/lib/demo/data";
import { generateId, nowISO } from "@/lib/services/helpers";

const STORE_KEY = "pharma_lms_sops_v1";

const SAMPLE_PDF =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

export interface SopStore {
  sops: SopDocument[];
  versions: SopVersion[];
  views: SopViewRecord[];
  acknowledgements: SopAcknowledgement[];
  trainingAssignments: TrainingAssignment[];
}

function makeAttachment(
  type: SopAttachment["type"],
  title: string,
  fileName: string,
  url: string,
  actorId: string
): SopAttachment {
  return {
    id: generateId("att"),
    type,
    title,
    fileName,
    storagePath: `demo/${fileName}`,
    downloadUrl: url,
    fileSize: type === "pdf" ? 245760 : type === "video" ? 5242880 : 1048576,
    mimeType:
      type === "pdf"
        ? "application/pdf"
        : type === "video"
          ? "video/mp4"
          : "application/vnd.ms-powerpoint",
    uploadedAt: nowISO(),
    uploadedBy: actorId,
  };
}

function seedVersions(): SopVersion[] {
  const now = "2026-03-01T00:00:00.000Z";
  return [
    {
      id: "sopv_001",
      sopId: "sop_001",
      versionNumber: "1.0",
      major: 1,
      minor: 0,
      changeSummary: "Initial release",
      storagePath: "sops/sop_001/v1.0.pdf",
      downloadUrl: SAMPLE_PDF,
      fileSize: 245760,
      mimeType: "application/pdf",
      status: "approved",
      attachments: [
        makeAttachment("pdf", "Document Control SOP", "SOP-QA-001.pdf", SAMPLE_PDF, "user_qa"),
        makeAttachment(
          "ppt",
          "Training deck",
          "SOP-QA-001.pptx",
          SAMPLE_PDF,
          "user_qa"
        ),
      ],
      approvedBy: "user_qa",
      approvedByName: "Rahul Mehta",
      approvedAt: now,
      effectiveDate: now,
      reviewDate: "2027-03-01T00:00:00.000Z",
      viewCount: 14,
      acknowledgementCount: 3,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: now,
      createdBy: "user_qa",
    },
    {
      id: "sopv_002",
      sopId: "sop_002",
      versionNumber: "1.0",
      major: 1,
      minor: 0,
      changeSummary: "Initial release",
      storagePath: "sops/sop_002/v1.0.pdf",
      downloadUrl: SAMPLE_PDF,
      fileSize: 312000,
      mimeType: "application/pdf",
      status: "approved",
      attachments: [
        makeAttachment("pdf", "Deviation SOP", "SOP-QA-002.pdf", SAMPLE_PDF, "user_qa"),
        makeAttachment(
          "video",
          "Deviation walkthrough",
          "deviation-intro.mp4",
          "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
          "user_qa"
        ),
      ],
      approvedBy: "user_qa",
      approvedByName: "Rahul Mehta",
      approvedAt: "2026-04-01T00:00:00.000Z",
      effectiveDate: "2026-04-01T00:00:00.000Z",
      reviewDate: "2027-04-01T00:00:00.000Z",
      viewCount: 9,
      acknowledgementCount: 2,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      createdBy: "user_qa",
    },
    {
      id: "sopv_003",
      sopId: "sop_003",
      versionNumber: "1.0",
      major: 1,
      minor: 0,
      changeSummary: "Draft for QA review",
      storagePath: "sops/sop_003/v1.0.pdf",
      downloadUrl: SAMPLE_PDF,
      fileSize: 180000,
      mimeType: "application/pdf",
      status: "under_review",
      attachments: [
        makeAttachment("pdf", "Line Clearance", "SOP-PRD-001.pdf", SAMPLE_PDF, "user_qa"),
      ],
      submittedForReviewAt: "2026-07-15T00:00:00.000Z",
      submittedBy: "user_qa",
      viewCount: 2,
      acknowledgementCount: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
      createdBy: "user_qa",
    },
  ];
}

function defaultStore(): SopStore {
  const versions = seedVersions();
  const sops: SopDocument[] = DEMO_SOPS.map((s) => {
    const v = versions.find((x) => x.id === s.currentVersionId);
    return {
      ...s,
      currentVersionNumber: v?.versionNumber || "1.0",
      reviewDate: v?.reviewDate || s.reviewDate || "2027-03-01T00:00:00.000Z",
      viewCount: v?.viewCount || 0,
      acknowledgementCount: v?.acknowledgementCount || 0,
    };
  });
  return {
    sops,
    versions,
    views: [
      {
        id: "view_001",
        sopId: "sop_001",
        versionId: "sopv_001",
        versionNumber: "1.0",
        userId: "user_emp",
        userName: "Aarav Kumar",
        userEmail: "employee@pharma.local",
        employeeId: "emp_001",
        viewedAt: "2026-06-18T10:00:00.000Z",
        durationSeconds: 420,
        source: "preview",
      },
    ],
    acknowledgements: [
      {
        id: "ack_001",
        sopId: "sop_001",
        versionId: "sopv_001",
        versionNumber: "1.0",
        userId: "user_emp",
        userName: "Aarav Kumar",
        userEmail: "employee@pharma.local",
        employeeId: "emp_001",
        acknowledgedAt: "2026-06-18T10:15:00.000Z",
        statement:
          "I have read and understood this SOP and agree to follow its requirements.",
      },
    ],
    trainingAssignments: [...DEMO_ASSIGNMENTS],
  };
}

export function readSopStore(): SopStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const seeded = defaultStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as SopStore;
  } catch {
    return defaultStore();
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
      // PPT etc. — keep placeholder for preview
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
