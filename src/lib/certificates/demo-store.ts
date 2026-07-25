/**
 * Demo certificate store — issued certificates with QR / PDF metadata.
 */

import type { Certificate } from "@/types";
import { DEMO_CERTIFICATES, isDemoMode } from "@/lib/demo/data";

const STORE_KEY = "pharma_lms_certificates_v1";
export const CERTIFICATES_UPDATED_EVENT = "pharma-certificates-updated";

export interface CertificateStore {
  certificates: Certificate[];
}

function enrichDemo(c: Certificate): Certificate {
  return {
    ...c,
    employeeName: c.employeeName || "Aarav Kumar",
    employeeCode: c.employeeCode || "EMP-QA-0001",
    departmentName: c.departmentName || "Quality Assurance",
    trainerName: c.trainerName || "Vikram Singh",
    sopNumber: c.sopNumber || "SOP-QA-001",
    sopTitle: c.sopTitle || "Document Control Procedure",
    companyName: c.companyName || "SkyMap Pharma",
    companyLogoUrl: c.companyLogoUrl || "/brand/skymap-logo.svg",
    signedBy: c.signedBy || "Dr. Meera Iyer",
    signedByTitle: c.signedByTitle || "Head of Quality Assurance",
    digitalSignatureUrl: c.digitalSignatureUrl || "/brand/qa-signature.svg",
  };
}

function defaultStore(): CertificateStore {
  return {
    certificates: DEMO_CERTIFICATES.map(enrichDemo),
  };
}

export function readCertificateStore(): CertificateStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const seeded = defaultStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as CertificateStore;
    if (!parsed.certificates?.[0]?.employeeName) {
      const seeded = defaultStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    return defaultStore();
  }
}

export function writeCertificateStore(store: CertificateStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CERTIFICATES_UPDATED_EVENT));
}

export function upsertCertificateLocal(cert: Certificate): void {
  const store = readCertificateStore();
  const idx = store.certificates.findIndex((c) => c.id === cert.id);
  if (idx >= 0) store.certificates[idx] = cert;
  else store.certificates.unshift(cert);
  writeCertificateStore(store);
}

export function shouldUseCertificateLocal(): boolean {
  return isDemoMode();
}
