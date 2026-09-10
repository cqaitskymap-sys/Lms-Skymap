import type { Certificate } from "@/types";

export const PROGRAMME_SOP_NUMBER = "TRAINING";
export const PROGRAMME_SOP_ID = "programme";
export const PROGRAMME_TITLE = "Prescribed Training Programme";
export const COMPUTER_GENERATED_NOTICE =
  "This is an electronically computer-generated certificate. No physical signature is required.";

export function isProgrammeCertificate(cert: Pick<Certificate, "kind" | "sopNumber">): boolean {
  return cert.kind === "programme" || cert.sopNumber === PROGRAMME_SOP_NUMBER;
}

export function certificateSubjectLine(
  cert: Pick<Certificate, "kind" | "sopNumber" | "sopTitle" | "programmeTitle">
): string {
  if (isProgrammeCertificate(cert)) {
    return cert.programmeTitle || PROGRAMME_TITLE;
  }
  return cert.sopTitle || PROGRAMME_TITLE;
}
