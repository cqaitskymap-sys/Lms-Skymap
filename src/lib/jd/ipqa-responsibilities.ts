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

const executive = "Executive/Sr. Executive";
const officer = "Officer/Sr. Officer";
const trainee = "Trainee/Officer";

const incharge = "IPQA (Incharge)";
const shopFloor = "IPQA";

export const IPQA_SECTIONS: { name: string; designations: JdDesignationResponsibilities[] }[] = [
  {
    name: incharge,
    designations: [
      role("ipqa-incharge-exec", executive, incharge, [
        "Responsible for monitoring of In-Process Quality Assurance activities i.e. Dispensing, Manufacturing, Filling, Packaging and Terminal Inspection etc. on shop floor.",
        "Responsible for checking of API Calculation for batch manufacturing.",
        "Responsible for Final Signed of TT.",
        "To ensure transfer of finished goods to store as per BMR & BPR and release of batch for sale & distribution after review of BMR & BPR.",
        "Responsible for final signed of filled BMR and BPR.",
        "To ensure timely sample withdrawal on shop floor.",
        "Responsible to coordinate during Qualifications & Validation activities on the shop floor.",
        "To coordinate Process Simulation Study (media fill) as per Approved Protocol.",
        "Review of executed batch processing records.",
        "Review of all documents relating to the Manufacturing, Packaging & analysis report prior to batch release.",
        "Review of documents of respective areas and logbooks for adequacy and completeness.",
        "QA oversight for receipt of material from Warehouse to Production.",
        "Review of departmental and shop floor related SOPs.",
      ]),
    ],
  },
  {
    name: shopFloor,
    designations: [
      role("ipqa-exec", executive, shopFloor, [
        "Handling of Line clearance activities of various stages i.e. manufacturing, dispensing, packing etc.",
        "Handling of Sampling Various stages as a like in process sample Finished products as per procedure.",
        "Handling of Sampling activities of various stages during Validation, qualification as per procedure.",
        "Responsible for In Process parameter Checks during manufacturing, dispensing, packing Stages.",
        "Responsible for handling of online documentation i.e. BMR, BPR, formats and Log Book.",
        "Responsible for Balance Calibration & Daily Verification as per procedure.",
        "Responsible for operation, cleaning and calibration of instruments i.e. pH Meter, lux meter, Conductivity/DO Meter etc as per procedure.",
        "Responsible for Environmental Monitoring & differential pressure as per procedure.",
        "Handling of leak test apparatus.",
        "Handling of Dispensing Activity.",
        "Handling of Terminal Inspection.",
      ]),
      role("ipqa-officer", officer, shopFloor, [
        "Handling of Line clearance activities of various stages i.e. manufacturing, dispensing, packing etc.",
        "Handling of Sampling Various stages as a like in process sample Finished products as per procedure.",
        "Handling of Sampling activities of various stages during Validation, qualification as per procedure.",
        "Responsible for In Process parameter Checks during manufacturing, dispensing, packing Stages.",
        "Responsible for handling of online documentation i.e. BMR, BPR, formats and Log Book.",
        "Responsible for Balance Calibration & Daily Verification as per procedure.",
        "Responsible for operation, cleaning and calibration of instruments i.e. pH Meter, lux meter, Conductivity/DO Meter etc as per procedure.",
        "Responsible for Environmental Monitoring & differential pressure as per procedure.",
      ]),
      role("ipqa-trainee", trainee, shopFloor, [
        "Handling of Line clearance activities of various stages i.e. manufacturing, dispensing, packing etc.",
        "Handling of Sampling Various stages as a like in process sample Finished products as per procedure.",
        "Handling of Sampling activities of various stages during Validation, qualification as per procedure.",
        "Responsible for In Process parameter Checks during manufacturing, dispensing, packing Stages.",
        "Responsible for handling of online documentation i.e. BMR, BPR, formats and Log Book.",
        "Responsible for Balance Calibration & Daily Verification as per procedure.",
        "Responsible for operation, cleaning and calibration of instruments i.e. pH Meter, lux meter, Conductivity/TDS meter, DO Meter etc as per procedure.",
        "Responsible for Environmental Monitoring & differential pressure as per procedure.",
      ]),
    ],
  },
];
