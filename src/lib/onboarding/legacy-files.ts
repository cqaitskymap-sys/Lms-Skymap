import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { isDemoMode } from "@/lib/demo/data";
import { generateId } from "@/lib/utils";
import {
  assertAllowedUpload,
  isControlledDocument,
  sanitizeStorageFileName,
} from "@/lib/uploads/safe-file";
import type { InductionSignedPaper } from "@/types";

export async function uploadLegacyRecordFile(params: {
  employeeCode: string;
  kind: "jd" | "tni";
  file: File;
  actorId: string;
}): Promise<InductionSignedPaper> {
  const label = params.kind === "jd" ? "Job Description" : "TNI";
  assertAllowedUpload(params.file, {
    maxBytes: 15 * 1024 * 1024,
    label,
    accept: isControlledDocument,
  });

  const safeName = sanitizeStorageFileName(params.file.name);
  const docId = generateId(params.kind === "jd" ? "jdfile" : "tnifile");
  const code = params.employeeCode.trim().toUpperCase();
  let storagePath: string;
  let downloadUrl: string;

  if (isDemoMode()) {
    storagePath = `demo/legacy-records/${code}/${params.kind}/${docId}_${safeName}`;
    downloadUrl =
      typeof URL !== "undefined" ? URL.createObjectURL(params.file) : "";
    if (!downloadUrl) throw new Error("Could not read the file in this browser");
  } else {
    storagePath = `legacy-records/${code}/${params.kind}/${docId}_${safeName}`;
    try {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, params.file, {
        contentType: params.file.type || "application/octet-stream",
      });
      downloadUrl = await getDownloadURL(storageRef);
    } catch (err) {
      const codeName =
        err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (codeName.includes("unauthorized") || codeName.includes("permission")) {
        throw new Error(
          "Storage rejected the JD/TNI upload. Deploy storage.rules so HR can write legacy-records/."
        );
      }
      throw err instanceof Error ? err : new Error("Upload failed");
    }
  }

  return {
    fileName: safeName,
    storagePath,
    downloadUrl,
    fileSize: params.file.size,
    mimeType: params.file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    uploadedBy: params.actorId,
  };
}
