import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAuth, unauthorized, writeAuditLog } from "@/lib/rbac/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { generateId } from "@/lib/utils";
import {
  acceptPoliciesSchema,
  completeOnboardingProfileSchema,
} from "@/lib/auth/onboarding-schemas";
import {
  CURRENT_POLICIES_VERSION,
  DEFAULT_COMPANY_POLICIES,
} from "@/lib/onboarding/policies";

/** List active company policies for first-login wizard */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorized();

  const snap = await adminDb
    .collection(COLLECTIONS.companyPolicies)
    .where("isActive", "==", true)
    .get();

  let policies = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (policies.length === 0) {
    policies = DEFAULT_COMPANY_POLICIES.map((p) => ({
      ...p,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
    }));
  }

  policies.sort((a, b) => Number((a as { order?: number }).order ?? 0) - Number((b as { order?: number }).order ?? 0));

  return NextResponse.json({
    success: true,
    data: {
      version: CURRENT_POLICIES_VERSION,
      policies,
    },
  });
}

/** Complete a first-login onboarding step: profile | policies | finish */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorized();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const step = (raw as { step?: string }).step;
  const now = new Date().toISOString();
  const userRef = adminDb.collection(COLLECTIONS.users).doc(auth.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ success: false, error: "User profile not found" }, { status: 404 });
  }
  const profile = userSnap.data()!;

  if (step === "profile") {
    const parsed = completeOnboardingProfileSchema.safeParse((raw as { data?: unknown }).data);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await userRef.update({
      displayName: parsed.data.displayName,
      phone: parsed.data.phone || profile.phone || "",
      mustUpdateProfile: false,
      updatedAt: now,
    });

    if (profile.employeeId) {
      const empPatch: Record<string, string | undefined> = {
        updatedAt: now,
        updatedBy: auth.uid,
      };
      if (parsed.data.phone) {
        empPatch.phone = parsed.data.phone;
        empPatch.mobile = parsed.data.phone;
      }
      if (parsed.data.address) empPatch.address = parsed.data.address;
      if (parsed.data.emergencyContact) empPatch.emergencyContact = parsed.data.emergencyContact;

      // Split display name best-effort into employee names if provided
      const parts = parsed.data.displayName.trim().split(/\s+/);
      if (parts.length >= 2) {
        empPatch.firstName = parts[0];
        empPatch.lastName = parts.slice(1).join(" ");
      }

      await adminDb.collection(COLLECTIONS.employees).doc(profile.employeeId).update(empPatch);
    }

    await writeAuditLog({
      actorId: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "update",
      resourceType: "user",
      resourceId: auth.uid,
      description: "Completed onboarding profile step",
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: { step: "profile" } });
  }

  if (step === "policies") {
    const parsed = acceptPoliciesSchema.safeParse((raw as { data?: unknown }).data);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const requiredIds = DEFAULT_COMPANY_POLICIES.filter((p) => p.isRequired).map((p) => p.id);
    const missing = requiredIds.filter((id) => !parsed.data.policyIds.includes(id));
    if (missing.length > 0) {
      // Also allow Firestore-backed policy IDs if present
      const snap = await adminDb
        .collection(COLLECTIONS.companyPolicies)
        .where("isActive", "==", true)
        .where("isRequired", "==", true)
        .get();
      if (!snap.empty) {
        const req = snap.docs.map((d) => d.id);
        const stillMissing = req.filter((id) => !parsed.data.policyIds.includes(id));
        if (stillMissing.length > 0) {
          return NextResponse.json(
            { success: false, error: "All required policies must be accepted" },
            { status: 400 }
          );
        }
      } else if (missing.length > 0) {
        return NextResponse.json(
          { success: false, error: "All required policies must be accepted" },
          { status: 400 }
        );
      }
    }

    const batch = adminDb.batch();
    for (const policyId of parsed.data.policyIds) {
      const id = generateId("pac");
      batch.set(adminDb.collection(COLLECTIONS.policyAcceptances).doc(id), {
        id,
        userId: auth.uid,
        employeeId: profile.employeeId || null,
        policyId,
        policyVersion: parsed.data.version,
        acceptedAt: now,
        ipAddress: request.headers.get("x-forwarded-for") || null,
        userAgent: request.headers.get("user-agent") || null,
      });
    }

    batch.update(userRef, {
      mustAcceptPolicies: false,
      policiesAcceptedAt: now,
      policiesVersion: parsed.data.version,
      updatedAt: now,
    });

    await batch.commit();

    const actId = generateId("act");
    await adminDb.collection(COLLECTIONS.activityLogs).doc(actId).set({
      id: actId,
      userId: auth.uid,
      employeeId: profile.employeeId,
      verb: "policies_accepted",
      summary: `Accepted company policies v${parsed.data.version}`,
      resourceType: "company_policies",
      resourceId: parsed.data.version,
      createdAt: now,
    });

    await writeAuditLog({
      actorId: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "sign",
      resourceType: "company_policies",
      resourceId: parsed.data.version,
      description: "Accepted company policies during onboarding",
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: { step: "policies" } });
  }

  if (step === "finish") {
    const fresh = (await userRef.get()).data()!;
    if (fresh.mustChangePassword) {
      return NextResponse.json(
        { success: false, error: "Change your password before finishing onboarding" },
        { status: 400 }
      );
    }
    if (fresh.mustUpdateProfile) {
      return NextResponse.json(
        { success: false, error: "Complete your profile before finishing onboarding" },
        { status: 400 }
      );
    }
    if (fresh.mustAcceptPolicies) {
      return NextResponse.json(
        { success: false, error: "Accept company policies before finishing onboarding" },
        { status: 400 }
      );
    }

    await userRef.update({
      onboardingCompletedAt: now,
      mustChangePassword: false,
      mustUpdateProfile: false,
      mustAcceptPolicies: false,
      updatedAt: now,
    });

    if (fresh.employeeId) {
      await adminDb.collection(COLLECTIONS.employees).doc(fresh.employeeId).update({
        onboardingStatus: "completed",
        updatedAt: now,
      });
    }

    const actId = generateId("act");
    await adminDb.collection(COLLECTIONS.activityLogs).doc(actId).set({
      id: actId,
      userId: auth.uid,
      employeeId: fresh.employeeId,
      verb: "onboarding_completed",
      summary: "First-login onboarding completed",
      resourceType: "user",
      resourceId: auth.uid,
      createdAt: now,
    });

    await writeAuditLog({
      actorId: auth.uid,
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "update",
      resourceType: "user",
      resourceId: auth.uid,
      description: "Completed first-login onboarding",
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, data: { step: "finish", redirect: "/dashboard/employee" } });
  }

  return NextResponse.json({ success: false, error: "Unknown step" }, { status: 400 });
}
