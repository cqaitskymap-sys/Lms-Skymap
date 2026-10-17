interface PrdLine {
  id: string;
  code: string;
  text: string;
}

interface PrdRole {
  id: string;
  designation: string;
  groups: { code: string; title: string; lines: PrdLine[] }[];
}

function role(id: string, designation: string, section: string, items: string[]): PrdRole {
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
const president = "President Operations";

const presidentItems = [
  "Strategic Planning: Develop and implement operational strategies aligned with the company's overall vision and objectives.",
  "Regulatory Compliance: Ensure compliance with regulatory requirements such as cGMP, FDA and EU guidelines, and support development of product formulations, systems and dossiers for export markets.",
  "Risk Management: Identify, assess and mitigate operational risks to ensure business continuity and minimise potential losses, in coordination with Quality Assurance.",
  "Manufacturing Excellence: Drive manufacturing excellence through process improvements, technology upgrades and employee development.",
  "Quality Management: Implement and maintain the production quality management system so that product quality meets the required standard.",
  "Supply Chain Management: Develop supply-chain strategies for timely and cost-effective delivery of materials and products, and oversee logistics and distribution to the customer.",
  "Engineering: Oversee engineering operations, including design, development, testing and commissioning of new equipment, processes and facilities. Identify and implement technologies that improve efficiency, reduce cost and support product quality.",
  "Budgeting and Cost Control: Develop and manage operational budgets, cost-effective operations and resource allocation.",
  "New Projects: Prepare project plans covering scope, schedule, budget and resources. Oversee execution so projects finish on time, within budget and to the required quality standard. Track risks, deviations and lessons learned, and close projects formally.",
  "Talent Development: Lead and develop teams through coaching, mentoring and training.",
  "R&D and Technology Transfer: Lead formulation and process work for injectable products, including scale-up, process optimisation, process validation and technology transfer from R&D to commercial manufacturing.",
  "Responsible for the self-inspection programme of all departments.",
  "Responsible for overall production operations of the sterile injectable manufacturing facility, in line with cGMP, applicable regulatory requirements, approved procedures and company quality standards.",
  "Responsible for approved production targets, batch schedules, capacity utilisation, productivity and on-time delivery of assigned manufacturing lines.",
  "Responsible for effective use of manpower, machines, materials, utilities, production area and other resources.",
  "Responsible for aseptic practices and contamination control throughout sterile manufacturing and filling operations.",
  "Responsible for departmental KPIs, including production achievement, productivity, yield, rejection, downtime, changeover time, right-first-time performance and cost of production.",
];

const managerItems = [
  "Accountable for manpower handling and all production-related activities of Ampoule line 1 and 2 and liquid vial injection.",
  "Execution and scheduling of production and packing planning for Ampoule line 1 and 2 and liquid injection.",
  "Review production documents such as BMR, BPR, MFR, equipment utilisation log and SOPs.",
  "Accountable for implementation of SOPs in all production in-process activities.",
  "Online periodic job training of junior staff and operators.",
  "Line management and manpower handling.",
  "On-the-job training of production staff.",
  "Accountable for batch production yield.",
  "Handle shop-floor deviation, incident and CAPA.",
  "Handle audit compliance and IPQA observations on the floor.",
  "Communicate with other departments to resolve problems.",
  "Review the contamination control strategy for sterile products.",
  "Perform the self-inspection programme of all departments as per the schedule planner.",
];

const hodItems = [
  "Accountable for all production-related activities of Ampoule line 1 and 2 and the liquid vial section.",
  "Execution and scheduling of production and packing planning for Ampoule line 1 and 2 and liquid injection.",
  "Accountable for all production-related activities of three-piece vial and dry powder injection.",
  "Execution and scheduling of production and packing planning for three-piece vial and dry powder injection.",
  "Prepare the monthly and weekly production plan.",
  "Ensure products are produced and stored as per the approved documentation so that the required quality is obtained.",
  "Review production documents such as BMR, BPR, MFR, equipment utilisation log and SOPs.",
  "Accountable for implementation of SOPs in all production in-process activities.",
  "Periodic job training of junior staff, operators and trainees.",
  "Line management and manpower handling.",
  "Accountable for batch production yield.",
  "Communicate with other departments to resolve problems.",
  "Handle online closing of all three lines (Ampoule line 1 and 2 and liquid vial injection).",
  "Handle shop-floor deviation, incident and CAPA, and audit compliance and IPQA observations on the floor.",
];

export const PRODUCTION_SECTIONS: { name: string; designations: PrdRole[] }[] = [
  {
    name: "Manufacturing process",
    designations: [
      role("prd-mfg-trainee", trainee, "Manufacturing process", [
        "Take line clearance for aseptic area filling, washing and manufacturing operation.",
        "Ensure CIP and SIP of the mixing vessel, product line, holding vessel and buffer vessel, with online records.",
        "Washing and filling area in-process activity and records.",
        "Supervision of de-cartoning in the washing area of Ampoule line 1 and 2 and the liquid vial line.",
        "Dispensing of raw material and primary packaging materials.",
        "Handling and preparation of disinfectant solution, bulk preparation and bulk filtration.",
        "Update all log books online as per the manufacturing and filling area specification.",
        "Ensure cleaning and sanitization of the washing and sterilization area.",
        "Ensure cleaning and operation of the autoclave.",
        "Ensure sterilization of rubber stoppers and of aseptic area accessories and equipment.",
        "Usage, cleaning and operation of the dynamic pass box and static pass box.",
        "Perform bubble point test of hydrophilic, hydrophobic and vent filters, and the water intrusion test.",
        "Cleaning and sterilization of machine parts and silicone tubes, and distribution of vials.",
      ]),
      role("prd-mfg-officer", officer, "Manufacturing process", [
        "Ensure cleaning and operation of the ampoule and vial washing machine, vial filling and rubber stoppering, and ampoule filling and sealing.",
        "Take line clearance for aseptic area cleaning, filling, washing and manufacturing operation.",
        "Ensure CIP and SIP of the mixing vessel, product line, holding vessel and buffer vessel, with online records.",
        "Ensure BMR and BPR are filled online.",
        "Filling in-process checks and records.",
        "Manpower handling.",
        "Dispensing of raw material and primary and secondary material.",
        "Ensure cleaning and operation of the DPI filling machine, DPI vial washing machine and three-piece filling machine.",
        "Disinfectant preparation and filtration.",
        "Bulk preparation and filtration.",
        "Keep all log books updated online as per the area specification.",
        "Ensure cleaning and sanitization of the washing and sterilization area.",
        "Ensure cleaning and operation of the autoclave.",
        "Sterile garment handling, including garment washing and sterilization.",
        "Ensure sterilization of bungs and of aseptic area accessories and equipment.",
        "Operation of the dynamic pass box and static pass box.",
        "Bubble point test of hydrophilic, hydrophobic and vent filters.",
      ]),
      role("prd-mfg-executive", executive, "Manufacturing process", [
        "Ensure cleaning and operation of the ampoule and vial washing machine, vial filling and rubber stoppering, and ampoule filling and sealing.",
        "Take line clearance for aseptic area cleaning, filling, washing and manufacturing operation.",
        "Ensure CIP and SIP of the mixing vessel, product line, holding vessel and buffer vessel, with online records.",
        "Review completion of BMR and BPR.",
        "Filling in-process checks and records.",
        "Manpower handling.",
        "Dispensing of raw material and primary and secondary material.",
        "Ensure cleaning and operation of the DPI filling machine, DPI vial washing machine and three-piece filling machine.",
        "Disinfectant preparation and filtration.",
        "Bulk preparation and filtration.",
        "Keep all log books updated online as per the area specification.",
        "Ensure cleaning and sanitization of the washing and sterilization area.",
        "Ensure cleaning and operation of the autoclave.",
        "Sterile garment handling, including garment washing and sterilization.",
        "Ensure sterilization of bungs and of aseptic area accessories and equipment.",
        "Integrity testing of hydrophilic and hydrophobic filters.",
        "Ensure cleaning and sterilization of machine parts and silicone tubes, and sanitization of vials.",
      ]),
      role("prd-mfg-manager", manager, "Manufacturing process", managerItems),
      role("prd-mfg-hod", hod, "Manufacturing process", hodItems),
      role("prd-mfg-president", president, "Manufacturing process", presidentItems),
    ],
  },
  {
    name: "Packing Process",
    designations: [
      role("prd-pack-trainee", trainee, "Packing Process", [
        "Take line clearance for packing, labeling, visual inspection and carton coding.",
        "Packing, labeling, visual inspection and carton coding in-process activity and records.",
        "Supervision of the packing, labeling, visual inspection and carton coding area.",
        "Dispensing of primary packaging materials.",
        "Handling and destruction entries.",
        "Update all log books online as per the packing specification.",
        "Ensure cleaning and sanitization of the packing area.",
        "Ensure cleaning and operation of labeling, auto-visual, blister and vial machines.",
        "Usage, cleaning and operation of the weighing balance.",
        "Activity of the manual visual inspection area.",
        "Manpower handling.",
        "Perform leak test of ampoule, eye drop, DPI and liquid vial.",
      ]),
      role("prd-pack-officer", officer, "Packing Process", [
        "Visual inspection, labeling and blister-machine packing of ampoules and vials.",
        "Cleaning and sanitization of the visual inspection, labeling and packing area for ampoules and vials.",
        "Issuance, handling and destruction entries.",
        "Issuance of primary and secondary packaging material.",
        "Line clearance of the packing line and materials, and online update of BPR and the packing-material log book.",
        "Packing in-process checks and records.",
        "Batch coding.",
        "Packing material accountability.",
        "Handling of manpower.",
        "Cleaning, line clearance and operation of the blister machine.",
        "Cleaning, line clearance and operation of the cartoner and vial labeling machine.",
        "Monitoring of visual inspection and the checkweigher.",
        "Labeling and packing of vials, three-piece and DPI lines.",
        "Handling of the BPR and production module.",
        "Perform leak test of ampoule, eye drop, DPI and liquid vial.",
      ]),
      role("prd-pack-executive", executive, "Packing Process", [
        "Visual inspection, labeling and blister-machine packing of ampoules and vials.",
        "Cleaning and sanitization of the visual inspection, labeling and packing area for ampoules and vials.",
        "Issuance of primary and secondary packaging material, and destruction entries.",
        "Line clearance of the packing line and materials, and online update of BPR and the packing-material log book.",
        "Packing in-process checks, records, issuance and handling.",
        "Batch coding and packing material accountability.",
        "Handling of manpower.",
        "Cleaning, line clearance and operation of the blister machine.",
        "Cleaning, line clearance and operation of the cartoner and vial labeling machine.",
        "Visual inspection, labeling and packing of vials, three-piece and DPI lines.",
        "Online entries and handling of the production module.",
        "Perform leak test of ampoule, eye drop, DPI and liquid vial.",
      ]),
      role("prd-pack-manager", manager, "Packing Process", managerItems),
      role("prd-pack-hod", hod, "Packing Process", hodItems),
      role("prd-pack-president", president, "Packing Process", presidentItems),
    ],
  },
  {
    name: "Filling Operation",
    designations: [
      role("prd-fill-trainee", trainee, "Filling Operation", [
        "Cleaning and sanitization of the aseptic area as per the defined schedule and frequency.",
        "Cleaning and sanitization of the grade C area as per the defined schedule and frequency.",
        "Cleaning and operation of the ampoule filling machine.",
        "Cleaning and operation of the dry powder filling and rubber stoppering machine.",
        "Cleaning and operation of the liquid vial filling machine.",
        "Cleaning and operation of the three-piece filling machine.",
        "Gowning in the grade C area and the aseptic area.",
        "Manufacturing bulk filtration.",
        "Work in the aseptic area.",
        "Cleaning of sterile garments.",
        "Cleaning and operation of the fogger.",
        "Operation and cleaning of the dynamic pass box.",
        "Monitoring of differential pressure.",
        "Monitoring of humidity in the aseptic area and grade C area.",
        "Handling of manpower.",
        "Coordinate with Engineering for machine breakdown.",
        "Troubleshoot problems on the filling lines.",
      ]),
    ],
  },
  {
    name: "Manufacturing Operator",
    designations: [
      role("prd-mfgop-trainee", trainee, "Manufacturing Operator", [
        "Cleaning and sanitization of the manufacturing area.",
        "Fogging in the grade C area and the aseptic area.",
        "Preparation of bulk solution and filtration of the batch.",
        "Calibration of the pH meter.",
        "Cleaning of the mixing vessel.",
        "CIP and SIP of the holding vessel.",
        "Dispensing of raw material and weighing.",
        "Calibration of the weighing balance.",
        "Update all documents and log books of the manufacturing area online.",
      ]),
    ],
  },
  {
    name: "Washing & Vessel Operator",
    designations: [
      role("prd-wash-trainee", trainee, "Washing & Vessel Operator", [
        "Cleaning and sanitization of the washing machine and depyrogenation tunnel.",
        "Fogging in the grade C area and the aseptic area.",
        "Operation and preventive maintenance of the machine as per its schedule.",
        "Check pressure-gauge parameters of WFI, PW and compressed air as per the SOP.",
        "Update machine and area logs online.",
        "Set conveyor speed as per the specified vial or ampoule size.",
        "Check area temperature, differential pressure and relative humidity, and enter them in the log books.",
        "Perform the challenge test as per frequency.",
        "Perform filter integrity of hydrophilic filters and vent filters.",
      ]),
    ],
  },
  {
    name: "Autoclave Operator",
    designations: [
      role("prd-auto-trainee", trainee, "Autoclave Operator", [
        "Cleaning and sanitization of the washing and sterilization area.",
        "Cleaning and operation of the autoclave.",
        "Cleaning and operation of the rapid-cooling steam sterilizer.",
        "Preparation of disinfectant solution.",
        "Sterilization of bungs and of aseptic area accessories and equipment.",
        "Perform VLT, HLT and Bowie-Dick test.",
        "Issuance, destruction, washing and sterilization of garments.",
        "Online documentation.",
        "Bubble point test of hydrophilic, hydrophobic and vent filters.",
        "Water intrusion test.",
        "Cleaning and sterilization of machine parts and silicone tubes, and disinfection of vials.",
        "Operation and cleaning of the dynamic pass box and static pass box.",
        "Operation and cleaning of the glove-port leak-test machine.",
      ]),
    ],
  },
  {
    name: "Sealing Operator",
    designations: [
      role("prd-seal-trainee", trainee, "Sealing Operator", [
        "Cleaning and sanitization of the sealing area and aseptic area as per the defined schedule and frequency.",
        "Fogging in the grade C area and the aseptic area.",
        "Cleaning and operation of the DPI vial sealing machine.",
        "Cleaning and operation of the liquid vial sealing machine.",
        "Update all aseptic-area documents online.",
        "Observe activity in the aseptic area.",
        "Cleaning and operation of the DPI filling and rubber stoppering machine, and the vial filling and capping machine.",
        "Cleaning and operation of the fogger.",
        "Cleaning and operation of the vial filling and sealing machine.",
      ]),
    ],
  },
  {
    name: "Packing Operator",
    designations: [
      role("prd-pkop-trainee", trainee, "Packing Operator", [
        "Cleaning and operation of the sticker labeling machine.",
        "Cleaning and operation of the auto-visual machine.",
        "Cleaning and operation of the auto-cartoning machine.",
        "Cleaning and operation of the collecting and wrapping machine.",
        "Cleaning and operation of the carton coding machine.",
        "Preventive maintenance and change parts of packing-area equipment.",
        "Handling of secondary packing material.",
        "Handling and decontamination of in-process rejection.",
        "Online documentation and handling of machine breakdown.",
        "Line clearance, machine changeover and product changeover.",
        "Ensure cleaning of the packing area.",
      ]),
    ],
  },
];
