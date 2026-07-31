/**
 * Local certificate store — empty by default (no seeded demo records).
 */

import type { Certificate } from "@/types";
import { isDemoMode } from "@/lib/demo/data";

const STORE_KEY = "pharma_lms_certificates_v2";
export const CERTIFICATES_UPDATED_EVENT = "pharma-certificates-updated";

export interface CertificateStore {
  certificates: Certificate[];
}

function emptyStore(): CertificateStore {
  return { certificates: [] };
}

export function readCertificateStore(): CertificateStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const store = emptyStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return store;
    }
    return JSON.parse(raw) as CertificateStore;
  } catch {
    return emptyStore();
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
