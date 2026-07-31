import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { formatEmployeeCode } from "@/lib/utils";

/**
 * Atomically allocate the next EMP###### code.
 * Counter lives at counters/employees { seq: number }.
 */
export async function allocateEmployeeCode(): Promise<string> {
  const ref = adminDb.collection(COLLECTIONS.counters).doc("employees");

  const code = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data()?.seq ?? 0) : 0;
    const next = Number.isFinite(current) && current >= 0 ? current + 1 : 1;
    tx.set(
      ref,
      {
        seq: next,
        updatedAt: new Date().toISOString(),
        prefix: "EMP",
        pad: 6,
      },
      { merge: true }
    );
    return formatEmployeeCode(next);
  });

  return code;
}
