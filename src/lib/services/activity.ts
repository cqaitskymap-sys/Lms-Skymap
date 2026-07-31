"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/client";
import type { ActivityVerb } from "@/types";
import { generateId } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo/data";

/**
 * Client-side activity breadcrumb (UX timeline).
 * Security-sensitive events should prefer server/Admin writes.
 */
export async function logActivity(params: {
  userId: string;
  employeeId?: string;
  verb: ActivityVerb;
  summary: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  if (isDemoMode()) return;
  try {
    const id = generateId("act");
    await addDoc(collection(db, COLLECTIONS.activityLogs), {
      id,
      ...params,
      createdAt: new Date().toISOString(),
      // serverTimestamp kept for query flexibility if rules allow
      _ts: serverTimestamp(),
    });
  } catch {
    /* non-blocking — never break UX for logging */
  }
}
