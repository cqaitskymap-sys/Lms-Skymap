/**
 * Baseline QA OJT topics taken from the company On Job Training matrix /
 * planner documents (SOP/QA series). Topic titles stay editable and are
 * replaced with the live SOP title when a matching SOP exists in the LMS.
 *
 * Some document rows use NA as the reference — those topics do not require an SOP.
 * This catalog is importable source data, not hardcoded production workflow logic.
 */

export interface OjtSeedTopic {
  trainingTopic: string;
  sopNumber?: string;
  referenceDocumentNumber?: string;
}

export const QA_OJT_SEED_TOPICS: OjtSeedTopic[] = [
  {
    trainingTopic: "Departmental workplace familiarization",
    referenceDocumentNumber: "NA",
  },
  {
    trainingTopic: "Good Documentation Practices",
    sopNumber: "SOP/QA/021",
    referenceDocumentNumber: "SOP/QA/021",
  },
  {
    trainingTopic: "Data Integrity Policy",
    sopNumber: "SOP/QA/060",
    referenceDocumentNumber: "SOP/QA/060",
  },
  {
    trainingTopic: "Procedure for Aseptic Behaviour and Technique",
    sopNumber: "SOP/QA/067",
    referenceDocumentNumber: "SOP/QA/067",
  },
  {
    trainingTopic: "Monitoring of temperature in Control Sample Room",
    sopNumber: "SOP/QA/068",
    referenceDocumentNumber: "SOP/QA/068",
  },
  { trainingTopic: "On Job Training — SOP/QA/069", sopNumber: "SOP/QA/069", referenceDocumentNumber: "SOP/QA/069" },
  { trainingTopic: "On Job Training — SOP/QA/071", sopNumber: "SOP/QA/071", referenceDocumentNumber: "SOP/QA/071" },
  { trainingTopic: "On Job Training — SOP/QA/072", sopNumber: "SOP/QA/072", referenceDocumentNumber: "SOP/QA/072" },
  { trainingTopic: "On Job Training — SOP/QA/075", sopNumber: "SOP/QA/075", referenceDocumentNumber: "SOP/QA/075" },
  { trainingTopic: "On Job Training — SOP/QA/079", sopNumber: "SOP/QA/079", referenceDocumentNumber: "SOP/QA/079" },
  { trainingTopic: "On Job Training — SOP/QA/080", sopNumber: "SOP/QA/080", referenceDocumentNumber: "SOP/QA/080" },
  { trainingTopic: "On Job Training — SOP/QA/081", sopNumber: "SOP/QA/081", referenceDocumentNumber: "SOP/QA/081" },
  { trainingTopic: "On Job Training — SOP/QA/082", sopNumber: "SOP/QA/082", referenceDocumentNumber: "SOP/QA/082" },
  { trainingTopic: "On Job Training — SOP/QA/083", sopNumber: "SOP/QA/083", referenceDocumentNumber: "SOP/QA/083" },
  { trainingTopic: "On Job Training — SOP/QA/084", sopNumber: "SOP/QA/084", referenceDocumentNumber: "SOP/QA/084" },
  { trainingTopic: "On Job Training — SOP/QA/087", sopNumber: "SOP/QA/087", referenceDocumentNumber: "SOP/QA/087" },
  { trainingTopic: "On Job Training — SOP/QA/088", sopNumber: "SOP/QA/088", referenceDocumentNumber: "SOP/QA/088" },
  { trainingTopic: "On Job Training — SOP/QA/089", sopNumber: "SOP/QA/089", referenceDocumentNumber: "SOP/QA/089" },
  { trainingTopic: "On Job Training — SOP/QA/090", sopNumber: "SOP/QA/090", referenceDocumentNumber: "SOP/QA/090" },
  { trainingTopic: "On Job Training — SOP/QA/091", sopNumber: "SOP/QA/091", referenceDocumentNumber: "SOP/QA/091" },
  { trainingTopic: "On Job Training — SOP/QA/092", sopNumber: "SOP/QA/092", referenceDocumentNumber: "SOP/QA/092" },
  { trainingTopic: "On Job Training — SOP/QA/094", sopNumber: "SOP/QA/094", referenceDocumentNumber: "SOP/QA/094" },
  { trainingTopic: "On Job Training — SOP/QA/095", sopNumber: "SOP/QA/095", referenceDocumentNumber: "SOP/QA/095" },
  { trainingTopic: "On Job Training — SOP/QA/096", sopNumber: "SOP/QA/096", referenceDocumentNumber: "SOP/QA/096" },
  { trainingTopic: "On Job Training — SOP/QA/098", sopNumber: "SOP/QA/098", referenceDocumentNumber: "SOP/QA/098" },
  { trainingTopic: "On Job Training — SOP/QA/099", sopNumber: "SOP/QA/099", referenceDocumentNumber: "SOP/QA/099" },
  { trainingTopic: "On Job Training — SOP/QA/100", sopNumber: "SOP/QA/100", referenceDocumentNumber: "SOP/QA/100" },
  { trainingTopic: "On Job Training — SOP/QA/101", sopNumber: "SOP/QA/101", referenceDocumentNumber: "SOP/QA/101" },
  { trainingTopic: "On Job Training — SOP/QA/104", sopNumber: "SOP/QA/104", referenceDocumentNumber: "SOP/QA/104" },
  { trainingTopic: "On Job Training — SOP/QA/105", sopNumber: "SOP/QA/105", referenceDocumentNumber: "SOP/QA/105" },
  { trainingTopic: "On Job Training — SOP/QA/106", sopNumber: "SOP/QA/106", referenceDocumentNumber: "SOP/QA/106" },
  { trainingTopic: "On Job Training — SOP/QA/108", sopNumber: "SOP/QA/108", referenceDocumentNumber: "SOP/QA/108" },
  { trainingTopic: "On Job Training — SOP/QA/109", sopNumber: "SOP/QA/109", referenceDocumentNumber: "SOP/QA/109" },
  { trainingTopic: "On Job Training — SOP/QA/110", sopNumber: "SOP/QA/110", referenceDocumentNumber: "SOP/QA/110" },
  { trainingTopic: "On Job Training — SOP/QA/111", sopNumber: "SOP/QA/111", referenceDocumentNumber: "SOP/QA/111" },
  { trainingTopic: "On Job Training — SOP/QA/112", sopNumber: "SOP/QA/112", referenceDocumentNumber: "SOP/QA/112" },
  { trainingTopic: "On Job Training — SOP/QA/113", sopNumber: "SOP/QA/113", referenceDocumentNumber: "SOP/QA/113" },
  { trainingTopic: "On Job Training — SOP/QA/114", sopNumber: "SOP/QA/114", referenceDocumentNumber: "SOP/QA/114" },
  { trainingTopic: "On Job Training — SOP/QA/115", sopNumber: "SOP/QA/115", referenceDocumentNumber: "SOP/QA/115" },
  { trainingTopic: "On Job Training — SOP/QA/116", sopNumber: "SOP/QA/116", referenceDocumentNumber: "SOP/QA/116" },
  { trainingTopic: "On Job Training — SOP/QA/117", sopNumber: "SOP/QA/117", referenceDocumentNumber: "SOP/QA/117" },
  { trainingTopic: "On Job Training — SOP/QA/118", sopNumber: "SOP/QA/118", referenceDocumentNumber: "SOP/QA/118" },
  { trainingTopic: "On Job Training — SOP/QA/119", sopNumber: "SOP/QA/119", referenceDocumentNumber: "SOP/QA/119" },
  {
    trainingTopic: "Parametric release of finished product",
    sopNumber: "SOP/QA/120",
    referenceDocumentNumber: "SOP/QA/120",
  },
];

export const QA_OJT_SOP_NUMBERS = QA_OJT_SEED_TOPICS.map((t) => t.sopNumber).filter(
  (v): v is string => Boolean(v)
);

export function normalizeSopNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s._-]+/g, "/");
}
