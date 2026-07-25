import type { CompanyPolicy } from "@/types";

/** Current org-wide policy pack version — bump when required policies change */
export const CURRENT_POLICIES_VERSION = "2026.1";

/**
 * Seed policies used when Firestore `company_policies` is empty.
 * HR/Admin can later manage these as documents; first-login always requires acceptance.
 */
export const DEFAULT_COMPANY_POLICIES: Omit<
  CompanyPolicy,
  "createdAt" | "updatedAt" | "createdBy"
>[] = [
  {
    id: "pol_code_of_conduct",
    version: CURRENT_POLICIES_VERSION,
    title: "Code of Conduct",
    summary: "Professional behaviour, integrity, and respectful workplace standards.",
    content: `You agree to uphold PharmaLMS / organisational standards of integrity, respect, and confidentiality. Harassment, discrimination, or misuse of systems is prohibited. Report concerns to HR promptly.`,
    isRequired: true,
    isActive: true,
    order: 1,
  },
  {
    id: "pol_data_privacy",
    version: CURRENT_POLICIES_VERSION,
    title: "Data Privacy & Confidentiality",
    summary: "Protect personal data, trade secrets, and regulated manufacturing records.",
    content: `You must not share credentials, patient/employee data, or proprietary documents outside authorised channels. Access is limited to your role. Breaches must be reported immediately.`,
    isRequired: true,
    isActive: true,
    order: 2,
  },
  {
    id: "pol_gmp_training",
    version: CURRENT_POLICIES_VERSION,
    title: "GMP & Training Compliance",
    summary: "Complete assigned induction and training before performing GxP tasks.",
    content: `You acknowledge that only trained and qualified personnel may perform GxP activities. You will complete induction modules, SOPs, and assessments as assigned and never sign for work you have not performed.`,
    isRequired: true,
    isActive: true,
    order: 3,
  },
  {
    id: "pol_it_acceptable_use",
    version: CURRENT_POLICIES_VERSION,
    title: "IT Acceptable Use",
    summary: "Secure use of LMS accounts, devices, and company networks.",
    content: `Accounts are personal and non-transferable. Do not share passwords. Use company systems for authorised work only. Suspicious activity must be reported to IT/HR.`,
    isRequired: true,
    isActive: true,
    order: 4,
  },
];
