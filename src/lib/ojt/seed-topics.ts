/**
 * Baseline QA OJT topics taken from the company On Job Training matrix /
 * planner documents (SOP/QA series). Topic titles stay editable and are
 * replaced with the live SOP title when a matching SOP exists in the LMS.
 *
 * Some document rows use NA as the reference — those topics do not require an SOP.
 */

export interface OjtSeedTopic {
  trainingTopic: string;
  sopNumber?: string;
  referenceDocumentNumber?: string;
}

/** SOP / reference numbers listed on the supplied QA OJT matrices. */
export const QA_OJT_SOP_NUMBERS = [
  "SOP/QA/067",
  "SOP/QA/068",
  "SOP/QA/069",
  "SOP/QA/071",
  "SOP/QA/079",
  "SOP/QA/080",
  "SOP/QA/081",
  "SOP/QA/082",
  "SOP/QA/083",
  "SOP/QA/084",
  "SOP/QA/087",
  "SOP/QA/088",
  "SOP/QA/089",
  "SOP/QA/090",
  "SOP/QA/091",
  "SOP/QA/092",
  "SOP/QA/094",
  "SOP/QA/095",
  "SOP/QA/096",
  "SOP/QA/098",
  "SOP/QA/099",
  "SOP/QA/100",
  "SOP/QA/101",
  "SOP/QA/104",
  "SOP/QA/105",
  "SOP/QA/106",
  "SOP/QA/108",
  "SOP/QA/109",
  "SOP/QA/110",
  "SOP/QA/111",
  "SOP/QA/112",
  "SOP/QA/113",
  "SOP/QA/114",
  "SOP/QA/115",
  "SOP/QA/116",
  "SOP/QA/117",
  "SOP/QA/118",
  "SOP/QA/119",
  "SOP/QA/120",
] as const;

export const QA_OJT_SEED_TOPICS: OjtSeedTopic[] = [
  {
    trainingTopic: "Departmental workplace familiarization",
    referenceDocumentNumber: "NA",
  },
  ...QA_OJT_SOP_NUMBERS.map((sopNumber) => ({
    trainingTopic: `On Job Training — ${sopNumber}`,
    sopNumber,
    referenceDocumentNumber: sopNumber,
  })),
];

export function normalizeSopNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s._-]+/g, "/");
}
