interface QaLine {
  id: string;
  code: string;
  text: string;
}

interface QaRole {
  id: string;
  designation: string;
  groups: { code: string; title: string; lines: QaLine[] }[];
}

function role(id: string, designation: string, section: string, items: string[]): QaRole {
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
const manager = "Manager";
const hod = "HOD";

export const QA_SECTIONS: { name: string; designations: QaRole[] }[] = [
  {
    name: "Issuance (Original and Withdrawal)",
    designations: [
      role("qa-issuance-trainee", trainee, "Issuance (Original and Withdrawal)", [
        "Issuance and retrieval of SOPs, specifications, STP and materials, and maintain the record.",
        "Issuance and retrieval of annexures, log books and other documents as per requirement, and maintain the record.",
        "Issue BMR and BPR after receiving the requisition from Production, and ensure timely retrieval of BMR and BPR from the production floor and maintain the record.",
        "Responsible for master and controlled copies of SOPs, annexures, BMR, BPR, specifications and STP. Issue and retrieve them as per procedure.",
        "Carry out any other activity assigned by Head QA after training on the respective topic.",
        "Ensure documents are complete, traceable and aligned with ALCOA+ principles.",
      ]),
    ],
  },
  {
    name: "PV (Analytical Data and Archival)",
    designations: [
      role("qa-pv-officer", officer, "PV (Analytical Data and Archival)", [
        "Responsible for preparation of the Process Validation protocol and report.",
        "Responsible for preparation of the execution plan for Process Validation activities as per protocol.",
        "Responsible for compilation of the Process Validation report.",
        "Responsible for preparation of the Hold Time Study protocol and report.",
        "Responsible for compilation of the Hold Time Study report.",
        "Responsible for review of analytical data related to Process Validation batches and ensuring compliance with the approved specifications.",
        "Responsible for review of master and executed batch manufacturing and packing records for completeness.",
        "Responsible for handling of vendor management documents as per procedure.",
        "Responsible for approval of MFR, BMR, vendor specification and BOM on ERP.",
        "Responsible for third-party queries and review of third-party documents.",
        "Responsible for review of the contamination control strategy for sterile product.",
        "Responsible for ensuring the self-inspection programme is executed on time for all departments as per the scheduled planner.",
        "Responsible for review and approval of QMS documents such as change control, deviation, incident, RCA and CAPA.",
        "Responsible for handling of market complaint and product recall.",
        "Execute the Process Validation study (media fill) as per the approved protocol.",
        "Responsible for handling of batch manufacturing and batch packing records as per procedure, including review of draft copy, master, effective, control, issuance, retrieval and obsolete copies.",
      ]),
    ],
  },
  {
    name: "BMR and BPR (Work)",
    designations: [
      role("qa-bmr-trainee", trainee, "BMR and BPR (Work)", [
        "Responsible for approval of BMR, BPR, BOM, MFR, COA and specifications on ERP.",
        "Responsible for master, control, issuance, retrieval and closure of SOPs, annexures, log books, specifications and STP, and for reporting as per procedure.",
        "Issuance and retrieval of SOPs, specifications, STP and materials, and maintain the record.",
        "Responsible for master and controlled copies of SOPs, annexures, BMR, BPR, specifications and STP. Issue and retrieve them as per procedure.",
        "Responsible for preparation of SOP.",
        "Responsible for master, control and issuance of BMR and BPR.",
        "Coordinate and schedule the training session.",
      ]),
    ],
  },
  {
    name: "Master of BMR & BPR / APQR and Vendor Management",
    designations: [
      role(
        "qa-bmr-apqr-officer",
        officer,
        "Master of BMR & BPR / APQR and Vendor Management",
        [
          "Responsible for review of master batch manufacturing and packing records for adequacy and compliance.",
          "Responsible for review of executed batch manufacturing documents and batch packing documents for completeness.",
          "Responsible for approval of batch manufacturing and batch packing documents for domestic and ROW markets.",
          "Responsible for batch release in ERP.",
          "Responsible for approval of QC specification in ERP.",
          "Responsible for preparation of the Product Quality Review as per procedure.",
          "Responsible for handling of vendor management documents as per procedure.",
          "Responsible for review of executed batch manufacturing and packing records for completeness.",
          "Responsible for handling of batch manufacturing and batch packing records as per procedure, including review of draft copy, master, effective, control, issuance, retrieval and obsolete copies.",
          "Responsible for approval of APQR, vendor, specification and BOM on ERP.",
          "Responsible for issuance, control, retrieval and closure of SOPs, annexures, log books, specifications and STP. Issue and report as per procedure.",
        ]
      ),
    ],
  },
  {
    name: "CAPA & Market Complaint",
    designations: [
      role("qa-capa-officer", officer, "CAPA & Market Complaint", [
        "Preparation and review of SOPs of the plant.",
        "Responsible for issuance of QMS documents such as deviation, incident, change control, OOS, CAPA and RCA.",
        "Ensure timely closure of deviation, incident, change control, OOS, CAPA and RCA, and update their status in the log book.",
        "Review investigation of the discrepancy through the QMS tool and check root-cause analysis.",
        "Review and check the effectiveness of CAPA after implementation as per the predefined timeline.",
        "Review master and controlled documents such as SOP, annexure, protocol and report.",
        "Review documents such as BMR and BPR.",
        "Log the market complaint and initiate investigation as per SOP, and acknowledge the market complaint.",
        "Responsible for review and approval of BMR, BPR and labels.",
        "Release the batch for sale and distribution after review of analytical data, COA and BPR.",
        "Prepare a compliance report for each event.",
      ]),
    ],
  },
  {
    name: "Training & GMP",
    designations: [
      role("qa-training-officer", officer, "Training & GMP", [
        "Responsible for preparation of the on-the-job training manual and on-the-job training matrix.",
        "Responsible for managing, designing, coordinating and conducting scheduled and unscheduled training sessions as per procedure, and for handling their records.",
        "Review training documents such as the on-the-job training planner, on-the-job training matrix, job description, TNI and training card to confirm the requirement.",
        "Ensure self-inspection is carried out as per the defined frequency in the schedule.",
        "Organize the cGMP training programme in the plant as per schedule.",
        "Responsible for preparation of quality documents such as the Quality Manual and Site Master File.",
      ]),
    ],
  },
  {
    name: "Artwork Management",
    designations: [
      role("qa-artwork-officer", officer, "Artwork Management", [
        "Responsible for handling artwork-related activities as per procedure, including review of artworks against the product permission, the artwork checklist and change control.",
      ]),
    ],
  },
  {
    name: "Stability",
    designations: [
      role("qa-stability-officer", officer, "Stability", [
        "Handling of the stability study, and maintain its records as per procedure.",
        "Responsible for receiving, storage and charging of stability samples.",
        "Preparation and reviewing of the stability protocol and report.",
        "Responsible for operation of walk-in type stability chambers.",
        "Responsible for withdrawal and reconciliation of stability samples as per the predefined schedule, and intimate the QC department for analysis.",
        "Responsible for monitoring of temperature and RH of walk-in type stability chambers.",
        "Responsible for ensuring cleaning of walk-in type stability chambers.",
        "Responsible for destruction of stability samples as per procedure.",
        "Responsible for receiving and storage of control samples, and maintain the records.",
        "Responsible for monitoring of temperature and RH of the control sample room, and maintain the records.",
        "Responsible for collecting, evaluating, organizing, managing, handling and submission of stability-related documents as per queries received from third parties, customers or the regulatory affairs department.",
        "Responsible for destruction of control samples as per procedure, and maintain the record.",
        "Coordinate with P&D and the F&D department if any correction is required in artwork or labels.",
        "Responsible for physical verification of control samples as per the predefined schedule, and report any discrepancy observed during the activity to Head QA.",
      ]),
    ],
  },
  {
    name: "Control Sample (Stability)",
    designations: [
      role("qa-control-sample-trainee", trainee, "Control Sample (Stability)", [
        "Handling of stability study management, and maintain its records as per procedure.",
        "Responsible for receiving, storage and charging of stability samples.",
        "Preparation and reviewing of the stability protocol and summary report.",
        "Responsible for operation of walk-in type stability chambers.",
        "Responsible for withdrawal and reconciliation of stability samples as per the predefined schedule, and intimate the QC department for analysis.",
        "Responsible for control sample management as per procedure.",
        "Responsible for destruction of stability samples as per procedure.",
        "Responsible for destruction of control samples as per procedure, and maintain the record.",
        "Responsible for ensuring cleaning of walk-in type stability chambers.",
        "Responsible for collecting, evaluating, organizing, managing, handling and submission of stability-related documents as per queries from third parties, customers and regulatory affairs.",
      ]),
    ],
  },
  {
    name: "Validation & Qualification",
    designations: [
      role("qa-val-qual-executive", executive, "Validation & Qualification", [
        "Responsible for preparation, execution and compilation of all validation protocols and reports.",
        "Responsible for verification of availability of vendors' documents during qualification.",
        "Responsible for execution of the Process Simulation Study (media fill) as per the approved protocol.",
        "Responsible for execution of all requalification activities as per the scheduled frequencies of the qualification planner.",
        "Responsible for execution of all calibration activities as per the scheduled frequencies of the calibration planner.",
        "Responsible for preparation and updation of the qualification and calibration planner.",
        "Responsible for handling of the equipment and instrument list of all the respective departments as per procedure.",
        "Responsible for handling of the list of authorized persons of all the respective departments as per procedure.",
        "Responsible for review and updation of quality documents such as the Quality Manual, Site Master File and Validation Master Plan.",
        "Responsible for master of documents, i.e. validation/qualification protocols, SOP, SMF, VMP and Quality Manual, as per the document and data control SOP.",
        "Responsible for review and updation of standard operating procedures.",
        "Responsible for review of batch manufacturing documents and batch packing documents.",
        "Responsible for review and approval of batch manufacturing and packing documents, i.e. BOM, MFR, BMR and BPR.",
        "Responsible for review and approval of all QMS documents, i.e. change controls, deviations, incidents, RCA, CAPA etc.",
        "Responsible for ensuring that change controls and planned/unplanned deviations are documented, reviewed and approved.",
        "Responsible for review of the contamination control strategy for sterile product.",
      ]),
    ],
  },
  {
    name: "Validation",
    designations: [
      role("qa-validation-officer", officer, "Validation", [
        "Responsible for carrying out all qualification and validation activity in the plant.",
        "Responsible for preparation, execution and compilation of all validation protocols and reports.",
        "Responsible for execution of the Process Simulation Study (media fill) as per the approved protocol.",
        "Responsible for execution of all requalification activities as per the scheduled frequencies of the qualification planner.",
        "Responsible for execution of all calibration activities as per the scheduled frequencies of the calibration planner.",
        "Responsible for handling of the equipment and instrument list of all the respective departments as per procedure.",
        "Responsible for master of documents, i.e. validation/qualification protocols, SOP, SMF, VMP and Quality Manual, as per the document and data control SOP.",
      ]),
      role("qa-validation-manager", manager, "Validation", [
        "All CDSCO (WHO), FDA and client audits, including preparation and submission of corrective and preventive action (CAPA) to the auditing body, until final closure.",
        "Ensure timely and effective implementation of all CAPA commitments for audit compliance.",
        "Periodic verification of the CAPA compliances and report the findings to the Head QA.",
        "Internal audit (cross-functional department).",
        "Calibration, qualification and validation: review, approval and execution of all calibration, qualification and validation protocols and reports, except CCS, CSV and media fill protocol and reports.",
        "Review, approval and updation of SOPs, protocols, documents and reports.",
        "Review and approval of SOPs of HR, Production, Stores, Engineering and QA.",
        "Approval of all protocols and reports for process validation, cleaning validation and other protocol-based studies, except CSV, media fill and CCS.",
        "Review, approval and management of QMS documents (domestic products): change control, deviations, risk management, incidents, RCA, CAPA, APQR, stability studies, market complaint and mock recalls for products meant for the domestic market.",
        "Risk management review and approval.",
        "Batch release (domestic): review and approval of filled BMR/BPR along with attached documents, and batch release for domestic.",
        "Maintenance and monitoring of retain samples, control samples and reference samples of each batch packed.",
        "In-process quality assurance: assist in in-process quality assurance (IPQA) activities to support compliance.",
      ]),
    ],
  },
  {
    name: "International Audits & Tech Transfer",
    designations: [
      role("qa-audits-hod", hod, "International Audits & Tech Transfer", [
        "International audits: all international audits, including preparation and submission of corrective and preventive action (CAPA) to the auditing body, until final closure.",
        "Ensure timely and effective implementation of all CAPA commitments for audit compliance.",
        "Monthly verification of the CAPA compliances and report the findings to the Head CQA.",
        "Tech transfer projects (products for overseas markets): coordination with the contract giver (CG), review of tech transfer (TT) documents and submit the gap report to CG.",
        "Review, approval and management of CG quality technical agreements (QTA) and scope of work (SOW) in coordination with International BD.",
        "Review, approval and management of product master documents related to the execution of tech transfer activities, in alignment with the scope of work (SOW).",
      ]),
    ],
  },
];
