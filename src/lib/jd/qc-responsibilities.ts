import type { JdDesignationResponsibilities } from "@/lib/jd/responsibility-catalog";

function role(
  id: string,
  designation: string,
  section: string,
  items: string[]
): JdDesignationResponsibilities {
  return {
    id,
    designation,
    groups: [
      {
        code: "1",
        title: section,
        lines: items.map((text, index) => ({
          id: `${id}-${index + 1}`,
          code: "",
          text,
        })),
      },
    ],
  };
}

const trainee = "Trainee/Officer";
const officer = "Officer/Sr. Officer";
const executive = "Executive/Sr. Executive";
const head = "Head-QC";

export const QC_SECTIONS: { name: string; designations: JdDesignationResponsibilities[] }[] = [
  {
    name: "Head-QC",
    designations: [
      role("qc-head", head, "Head-QC", [
        "Plan, organize and monitor quality control activities.",
        "Delegate work to trained staff and guide the team.",
        "Review analytical data, reports and results.",
        "Ensure testing is carried out as per approved specifications, STP and SOP.",
        "Ensure compliance with GLP, GDP and data integrity requirements.",
        "Review and approve QC documents.",
        "Review OOS, OOT, deviations and laboratory investigations.",
        "Identify training needs and ensure personnel are trained before they perform the activity.",
        "Coordinate internal audits, customer audits and regulatory inspections.",
        "Ensure required resources, instruments, standards and documents are available.",
        "Review trends and support CAPA.",
      ]),
    ],
  },
  {
    name: "RM / PM",
    designations: [
      role("qc-rmpm-trainee", trainee, "RM / PM", [
        "Sampling of raw material and packing material as per SOP.",
        "Entry of sample inward details and sample identification.",
        "Verification of the approved specification and STP before analysis.",
        "Chemical analysis of raw material and packing material.",
        "Instrument analysis of raw material and packing material as applicable.",
        "Preparation of worksheets, calculation sheets and analytical reports.",
        "Online documentation and review of records.",
        "Status labeling and handling of under-test, approved and rejected material.",
        "Documentation as per ALCOA and data integrity principles.",
        "Coordination with warehouse and the user department for sampling and release.",
      ]),
    ],
  },
  {
    name: "GLP / GDP",
    designations: [
      role("qc-glp-officer", officer, "GLP / GDP", [
        "Calibration and daily verification of laboratory instruments.",
        "Preparation and standardization of volumetric solutions.",
        "Preparation and management of reagents and chemicals.",
        "Receipt, storage, use and documentation of working standards and reference standards.",
        "Management of HPLC and GC columns.",
        "Management of culture, media and microbiological accessories.",
        "Support environmental monitoring activities.",
        "Destruction and disposal of laboratory waste as per SOP.",
        "Entry and review of laboratory logbooks.",
      ]),
    ],
  },
  {
    name: "Calibration",
    designations: [
      role("qc-calibration-officer", officer, "Calibration", [
        "Preparation and update of the master calibration planner.",
        "Internal calibration of instruments as per SOP.",
        "Coordination of external calibration and follow-up of calibration due dates.",
        "Review of calibration certificates.",
        "Qualification of instruments as per the approved plan.",
        "Follow-up of AMC for laboratory instruments.",
        "Documentation of calibration and qualification records.",
      ]),
    ],
  },
  {
    name: "Qualification and Validation",
    designations: [
      role("qc-validation-exec", executive, "Qualification and Validation", [
        "Preparation, review and execution of qualification protocols and reports.",
        "Preparation, review and execution of validation protocols and reports.",
        "IQ, OQ and PQ of laboratory instruments.",
        "Support method validation, method verification and method transfer.",
        "Preparation and follow-up of the calibration and qualification plan.",
        "Review of executed protocols, raw data and reports.",
        "Documentation of qualification and validation records as per SOP.",
      ]),
    ],
  },
  {
    name: "Microbiology",
    designations: [
      role("qc-micro-trainee", trainee, "Microbiology", [
        "Preparation and sterilization of media.",
        "Growth promotion testing of media.",
        "Microbial limit test.",
        "Sterility testing and bacterial endotoxin testing as applicable.",
        "Environmental monitoring.",
        "Water testing.",
        "Handling and maintenance of cultures.",
        "Preparation of worksheets and microbiological reports.",
        "Documentation as per SOP and data integrity requirements.",
      ]),
      role("qc-micro-officer", officer, "Microbiology", [
        "Review of microbiological testing data and reports.",
        "Review of media preparation, culture and environmental monitoring records.",
        "Review of sterility, microbial limit and water testing data.",
        "Investigation of microbiological OOS, OOT and deviations.",
        "Trending of microbiological data.",
        "Ensure microbiological documentation meets data integrity requirements.",
        "Guide and train the microbiology team on allocated activities.",
      ]),
    ],
  },
  {
    name: "Stability",
    designations: [
      role("qc-stability-trainee", trainee, "Stability", [
        "Receipt, labeling and storage of stability samples.",
        "Charging and withdrawal of stability samples as per the protocol.",
        "Entry of stability sample details.",
        "Check of sample storage condition.",
        "Preparation of stability worksheets.",
        "Reconciliation and documentation of stability samples.",
      ]),
      role("qc-stability-officer", officer, "Stability", [
        "Preparation and review of stability protocols.",
        "Charging, withdrawal and management of stability samples.",
        "Monitoring of stability chamber temperature and humidity.",
        "Stability testing as per the approved protocol.",
        "Review of stability data, chromatograms and reports.",
        "Handling of stability OOS and OOT.",
        "Stability documentation and logbooks.",
        "Trending of stability results.",
        "Support to stability investigations.",
      ]),
      role("qc-stability-exec", executive, "Stability", [
        "Review of stability protocols, data and reports.",
        "Review of stability OOS, OOT and investigations.",
        "Review of method validation data related to stability.",
        "Ensure stability documentation and data integrity.",
        "Guide the stability team on allocated activities.",
      ]),
    ],
  },
  {
    name: "Chemical and Instrument Analysis",
    designations: [
      role("qc-analysis-exec", executive, "Chemical and Instrument Analysis", [
        "Review of chemical analysis data and reports.",
        "Review of instrumental analysis data, chromatograms and reports.",
        "Handling of OOS and OOT for chemical and instrumental analysis.",
        "Ensure instruments are calibrated and qualified before use.",
        "Check compliance with the approved specification and STP.",
        "Ensure analytical documentation and data integrity.",
      ]),
    ],
  },
  {
    name: "Water and Environment",
    designations: [
      role("qc-water-trainee", trainee, "Water and Environment", [
        "Sampling and testing of purified water and water for injection as applicable.",
        "Environmental monitoring sampling.",
        "Entry of water and environmental monitoring results.",
        "Preparation of worksheets and reports.",
        "Documentation as per SOP.",
      ]),
    ],
  },
  {
    name: "Documentation and Investigation",
    designations: [
      role("qc-doc-exec", executive, "Documentation and Investigation", [
        "Review of analytical worksheets, raw data and reports.",
        "Review and follow-up of OOS, OOT and deviations.",
        "Support to laboratory investigations.",
        "Review of logbooks and online documentation.",
        "Ensure ALCOA and data integrity.",
        "Control of QC documents and records.",
      ]),
    ],
  },
  {
    name: "Analytical Data Review",
    designations: [
      role("qc-review-exec", executive, "Analytical Data Review", [
        "Review of analytical data before release.",
        "Review of calculations, chromatograms and analytical reports.",
        "Checking of OOS, OOT and atypical results.",
        "Ensure data integrity and traceability of analytical records.",
        "Check instrument usage and calibration status before acceptance of data.",
      ]),
    ],
  },
];
