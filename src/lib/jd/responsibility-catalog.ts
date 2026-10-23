import { IPQA_SECTIONS } from "@/lib/jd/ipqa-responsibilities";
import { PRODUCTION_SECTIONS } from "@/lib/jd/production-responsibilities";
import { QA_SECTIONS } from "@/lib/jd/qa-responsibilities";
import { QC_SECTIONS } from "@/lib/jd/qc-responsibilities";

export interface JdResponsibilityLine {
  id: string;
  /** Display code such as 2.1. Empty when the section is a single statement. */
  code: string;
  text: string;
}

export interface JdResponsibilityGroup {
  code: string;
  title: string;
  lines: JdResponsibilityLine[];
}

export interface JdDesignationResponsibilities {
  id: string;
  designation: string;
  groups: JdResponsibilityGroup[];
}

export interface JdCatalogSection {
  name: string;
  designations: JdDesignationResponsibilities[];
}

interface CatalogDepartment {
  id: string;
  /** Matched against department code and name. */
  matchers: string[];
  /** Same responsibilities for every sub-department. */
  designations?: JdDesignationResponsibilities[];
  /** Responsibilities that change with the sub-department / section. */
  sections?: JdCatalogSection[];
}

function norm(value: string | undefined | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bh\s+r\b/g, "hr")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDesignation(
  id: string,
  designation: string,
  groups: { code: string; title: string; items: string[]; numbered?: boolean }[]
): JdDesignationResponsibilities {
  return {
    id,
    designation,
    groups: groups.map((group) => {
      const numbered = group.numbered ?? group.items.length > 1;
      return {
        code: group.code,
        title: group.title,
        lines: group.items.map((text, index) => ({
          id: `${id}-${group.code}-${index + 1}`,
          code: numbered ? `${group.code}.${index + 1}` : "",
          text,
        })),
      };
    }),
  };
}

const officerHr = buildDesignation("hr-officer", "Officer HR", [
  {
    code: "1",
    title: "Role Purpose",
    items: [
      "Execute routine HR and administration activities accurately, maintain records and provide timely coordination and support.",
    ],
  },
  {
    code: "2",
    title: "Human Resource Planning and Organization",
    items: [
      "Maintain organization charts, employee designation records, headcount data and approved manpower records.",
      "Collect manpower requirements from departments and update monthly manpower reports.",
      "Maintain job descriptions and records of employee transfers, promotions and departmental changes.",
    ],
  },
  {
    code: "3",
    title: "Recruitment and Selection",
    items: [
      "Receive manpower requisitions and screen applications against approved job requirements.",
      "Coordinate interviews, tests, document verification, joining formalities and induction schedules.",
      "Prepare offer/appointment letters after approval and maintain recruitment records and vacancy trackers.",
    ],
  },
  {
    code: "4",
    title: "Contract Manpower Management",
    items: [
      "Coordinate with approved contractors for deployment and verify joining documents before deployment.",
      "Update contract worker details in Time Office Software and maintain attendance/deployment records.",
      "Coordinate replacement, exit documentation and wage/statutory documents; arrange immediate first aid and escalate emergencies.",
    ],
  },
  {
    code: "5",
    title: "Induction, Training and Development",
    items: [
      "Arrange induction and training sessions and communicate company policies, rules and code of conduct.",
      "Maintain training calendars, attendance sheets and training records; follow up on pending mandatory training.",
      "Coordinate cGMP, safety, fire safety, emergency response and first-aid training with concerned departments.",
    ],
  },
  {
    code: "6",
    title: "Medical Examination and Health Records",
    items: [
      "Schedule pre-employment and periodic medical examinations and follow up on pending fitness certificates.",
      "Maintain confidential medical fitness records with appropriate access controls.",
      "Escalate documentation gaps and fitness restrictions to authorized personnel while protecting confidentiality.",
    ],
  },
  {
    code: "7",
    title: "Attendance, Time Office and Payroll",
    items: [
      "Maintain daily attendance, shift, overtime, late-coming and absenteeism records.",
      "Verify approved leave and attendance corrections and prepare monthly payroll inputs.",
      "Coordinate bank/master data updates, payroll discrepancies and EPF/ESIC information with the responsible team.",
    ],
  },
  {
    code: "8",
    title: "Benefits, Welfare and Engagement",
    items: [
      "Maintain benefit enrollment and welfare records and respond to routine employee queries.",
      "Coordinate approved engagement, recognition and welfare activities.",
      "Record employee concerns and refer issues requiring higher-level decisions to the supervisor.",
    ],
  },
  {
    code: "9",
    title: "Employee Relations, Grievances and Discipline",
    items: [
      "Receive and document grievances and maintain confidential records.",
      "Coordinate employee counselling and complaint follow-up as directed by the supervisor.",
      "Prepare documentation for disciplinary matters and escalate serious issues to authorized management.",
    ],
  },
  {
    code: "10",
    title: "Separation and Exit Management",
    items: [
      "Coordinate resignation formalities, departmental clearances, no-dues and handover of company property.",
      "Prepare relieving/experience letters after authorization and coordinate F&F inputs with Accounts.",
      "Update employee master data and maintain exit interview and separation records.",
    ],
  },
  {
    code: "11",
    title: "HR Policies, SOPs and Documentation",
    items: [
      "Maintain employee personal files, appointment and movement letters, attendance, leave and training records.",
      "Prepare/update HR SOP drafts and circulate approved policy changes to concerned employees.",
      "Ensure proper filing, retrieval, retention and confidentiality of HR documents.",
    ],
  },
  {
    code: "12",
    title: "Factory, Labour Law and Statutory Compliance",
    items: [
      "Maintain statutory registers, notices, returns and supporting compliance documents as assigned.",
      "Track due dates for licences, EPF/ESI contributions and other applicable statutory submissions.",
      "Support inspections and audits, maintain evidence of closure and promptly escalate overdue items or workplace accidents.",
    ],
  },
  {
    code: "13",
    title: "General Administration, Security and Facilities",
    items: [
      "Coordinate daily administration, visitor registration, gate records and access-control documentation.",
      "Monitor canteen, housekeeping, hygiene, first-aid facilities and pest/rodent control activities.",
      "Coordinate fire drills, emergency preparedness and cleaning/sanitization activities with responsible teams.",
    ],
  },
  {
    code: "14",
    title: "General Responsibility",
    items: [
      "Perform assigned duties as per approved company policies, SOPs and instructions; maintain confidentiality and escalate exceptions to the reporting person.",
    ],
  },
]);

const executiveHr = buildDesignation("hr-executive", "Executive HR", [
  {
    code: "1",
    title: "Role Purpose",
    items: [
      "Independently coordinate assigned HR and administration processes, maintain compliance records and report progress and exceptions.",
    ],
  },
  {
    code: "2",
    title: "Human Resource Planning and Organization",
    items: [
      "Consolidate departmental manpower requirements and prepare monthly manpower and utilization reports.",
      "Review and update organization charts, job descriptions, reporting relationships and headcount records.",
      "Coordinate employee transfers, promotions and designation changes through the approved process.",
    ],
  },
  {
    code: "3",
    title: "Recruitment and Selection",
    items: [
      "Coordinate end-to-end recruitment for assigned positions, from requisition through joining.",
      "Manage sourcing, screening, interview scheduling, assessment coordination and candidate document verification.",
      "Track vacancy ageing and recruitment timelines; coordinate agencies and report delays or pending approvals.",
    ],
  },
  {
    code: "4",
    title: "Contract Manpower Management",
    items: [
      "Plan contract manpower deployment with departments and approved contractors.",
      "Verify contractor and worker documentation, monitor attendance/availability and coordinate replacement.",
      "Check wage and statutory compliance documents and resolve routine deployment issues.",
    ],
  },
  {
    code: "5",
    title: "Induction, Training and Development",
    items: [
      "Coordinate induction programmes and ensure employees receive applicable policy and code-of-conduct information.",
      "Prepare the annual training calendar with departments and QA; monitor mandatory and refresher training completion.",
      "Collect training effectiveness feedback and maintain complete training documentation.",
    ],
  },
  {
    code: "6",
    title: "Medical Examination and Health Records",
    items: [
      "Coordinate pre-employment and periodic medical examinations with authorized medical providers.",
      "Monitor fitness clearances before joining/deployment and follow up on pending cases.",
      "Review medical documentation completeness and escalate fitness-related restrictions confidentially.",
    ],
  },
  {
    code: "7",
    title: "Attendance, Time Office and Payroll",
    items: [
      "Review attendance, leave, overtime and shift inputs and prepare monthly payroll summaries.",
      "Coordinate payroll processing with Accounts/Finance and investigate routine discrepancies.",
      "Coordinate EPF/ESIC contribution data, challan inputs and secure maintenance of payroll records.",
    ],
  },
  {
    code: "8",
    title: "Benefits, Welfare and Engagement",
    items: [
      "Administer employee benefits and maintain enrollment and welfare records in line with company policy.",
      "Plan and coordinate engagement, recognition and employee assistance activities after approval.",
      "Analyze recurring employee queries and recommend process improvements to the reporting manager.",
    ],
  },
  {
    code: "9",
    title: "Employee Relations, Grievances and Discipline",
    items: [
      "Document grievances, conduct preliminary fact-finding and coordinate resolution with concerned departments.",
      "Support counselling, disciplinary documentation and employee communication under approved procedures.",
      "Maintain confidentiality and escalate serious or unresolved matters to management.",
    ],
  },
  {
    code: "10",
    title: "Separation and Exit Management",
    items: [
      "Coordinate resignation, clearance, handover, exit interview and separation documentation.",
      "Verify leave balance, advances, recoveries and other F&F inputs with relevant departments.",
      "Track timely issue of authorized letters and closure of employee master records.",
    ],
  },
  {
    code: "11",
    title: "HR Policies, SOPs and Documentation",
    items: [
      "Draft and review HR policies/SOPs and coordinate document-control review and approval.",
      "Monitor completeness of employee files and records and coordinate correction of documentation gaps.",
      "Ensure current approved policies are communicated and confidential information is access-controlled.",
    ],
  },
  {
    code: "12",
    title: "Factory, Labour Law and Statutory Compliance",
    items: [
      "Coordinate statutory registers, returns, notices, licence renewals and submissions within due dates.",
      "Track EPF/ESI and other applicable statutory requirements with authorized consultants and teams.",
      "Coordinate inspections/audits, maintain evidence of compliance and prepare accident reports and follow-up records.",
    ],
  },
  {
    code: "13",
    title: "General Administration, Security and Facilities",
    items: [
      "Coordinate security, gate access, visitor control and incident follow-up.",
      "Monitor canteen, housekeeping, hygiene, first-aid, fire-safety and pest-control service activities.",
      "Coordinate plant cleaning and sanitization with responsible departments and service providers.",
    ],
  },
  {
    code: "14",
    title: "General Responsibility",
    items: [
      "Ensure assigned processes follow approved policies, SOPs and applicable requirements; maintain confidentiality and escalate risks, delays and deviations.",
    ],
  },
]);

const managerHr = buildDesignation("hr-manager", "Manager – HR", [
  {
    code: "1",
    title: "Role Purpose",
    items: [
      "Lead HR and administration strategy, governance, compliance oversight and workforce planning in line with business requirements.",
    ],
  },
  {
    code: "2",
    title: "Human Resource Planning and Organization",
    items: [
      "Set direction for manpower planning, organization design, job architecture and workforce utilization.",
      "Review and recommend manpower budgets, headcount, organization charts and major staffing changes for approval.",
      "Advise management on workforce requirements, succession, transfers, promotions and organization effectiveness.",
    ],
  },
  {
    code: "3",
    title: "Recruitment and Selection",
    items: [
      "Own the recruitment strategy, hiring governance and workforce delivery against business requirements.",
      "Approve recruitment plans and recommendations within delegated authority and ensure fair, consistent selection practices.",
      "Review recruitment performance, critical vacancies, agency effectiveness and hiring risks with leadership.",
    ],
  },
  {
    code: "4",
    title: "Contract Manpower Management",
    items: [
      "Set controls for contract manpower sourcing, deployment, contractor performance and compliance oversight.",
      "Review contractor risks, manpower availability, statutory documentation and corrective action plans.",
      "Ensure escalation and response arrangements exist for contractor employee emergencies and workplace safety incidents.",
    ],
  },
  {
    code: "5",
    title: "Induction, Training and Development",
    items: [
      "Approve the HR training framework and annual training calendar in coordination with department heads and QA.",
      "Ensure induction, cGMP, safety and mandatory training requirements are resourced, completed and documented.",
      "Review training effectiveness and direct improvement actions based on business and compliance needs.",
    ],
  },
  {
    code: "6",
    title: "Medical Examination and Health Records",
    items: [
      "Ensure a compliant system is in place for pre-employment and periodic medical examinations and fitness clearance.",
      "Review significant overdue cases and ensure appropriate escalation and corrective action.",
      "Maintain governance for confidentiality and authorized access to employee medical records.",
    ],
  },
  {
    code: "7",
    title: "Attendance, Time Office and Payroll",
    items: [
      "Oversee attendance, time-office and payroll controls, accuracy, confidentiality and timely processing.",
      "Review payroll reports and significant exceptions with HR and Accounts/Finance and resolve escalated issues.",
      "Ensure appropriate controls for payroll approvals, bank/master data, EPF/ESIC coordination and records.",
    ],
  },
  {
    code: "8",
    title: "Benefits, Welfare and Engagement",
    items: [
      "Set priorities for employee benefits, welfare, engagement and recognition within company policy and approved budget.",
      "Review employee feedback and welfare trends and sponsor improvements that support employee relations.",
      "Ensure consistent communication between employees, HR, departments and management.",
    ],
  },
  {
    code: "9",
    title: "Employee Relations, Grievances and Discipline",
    items: [
      "Lead resolution of significant or sensitive employee relations matters and advise management on appropriate action.",
      "Ensure grievance and disciplinary processes are fair, confidential, documented and aligned with policy and applicable law.",
      "Review recurring issues and establish preventive actions to improve workplace relations.",
    ],
  },
  {
    code: "10",
    title: "Separation and Exit Management",
    items: [
      "Oversee separation governance, F&F coordination, exit feedback and timely closure of employee records.",
      "Review trends from exit interviews and direct retention or policy improvements.",
      "Ensure all separation documents and payments follow delegated approval requirements.",
    ],
  },
  {
    code: "11",
    title: "HR Policies, SOPs and Documentation",
    items: [
      "Own the HR policy and SOP framework, review cycle, document control and implementation monitoring.",
      "Ensure employee records are secure, complete, retrievable and retained according to applicable requirements.",
      "Review audit findings and ensure corrective actions are completed for HR documentation gaps.",
    ],
  },
  {
    code: "12",
    title: "Factory, Labour Law and Statutory Compliance",
    items: [
      "Provide oversight of applicable labour, factory and employment compliance with authorized personnel and consultants.",
      "Review compliance calendars, statutory returns, licence renewals, EPF/ESI matters, audit findings and significant risks.",
      "Ensure timely management escalation and closure of statutory gaps, inspections and workplace accident reporting.",
    ],
  },
  {
    code: "13",
    title: "General Administration, Security and Facilities",
    items: [
      "Set oversight standards for plant administration, security, access control, facilities and service providers.",
      "Review performance and risks relating to canteen, housekeeping, hygiene, first aid, fire safety, pest control and sanitation.",
      "Ensure emergency preparedness, incident escalation and corrective action across the facility.",
    ],
  },
  {
    code: "14",
    title: "General Responsibility",
    items: [
      "Ensure HR & Administration processes operate within approved policies, delegated authority and applicable requirements; review performance and ensure closure of significant risks.",
    ],
  },
]);

const deputyManagerHr = buildDesignation("hr-deputy-manager", "Deputy Manager HR", [
  {
    code: "1",
    title: "Role Purpose",
    items: [
      "Coordinate and oversee day-to-day HR and Administration operations, review process controls and compliance status, guide assigned team members, and recommend improvements to the Manager.",
    ],
  },
  {
    code: "2",
    title: "Human Resource Planning and Organization",
    items: [
      "Coordinate monthly manpower planning with department heads based on production requirements and approved headcount.",
      "Review manpower utilization, vacancies, employee transfers and designation changes; submit recommendations to the Manager.",
      "Maintain and review organization charts, job descriptions, reporting relationships and employee headcount records.",
      "Identify manpower budget deviations and escalate them with supporting details.",
    ],
  },
  {
    code: "3",
    title: "Recruitment and Selection",
    items: [
      "Coordinate recruitment activities for approved vacancies and monitor hiring timelines.",
      "Review manpower requisitions, candidate shortlists, interview schedules and selection documentation before submission for approval.",
      "Coordinate with department heads, recruitment agencies and external manpower sources as required.",
      "Monitor critical vacancies and recruitment status and report delays or hiring risks to the Manager.",
      "Ensure offer letters, appointment letters, joining records and recruitment files are prepared as per approved procedures.",
    ],
  },
  {
    code: "4",
    title: "Contract Manpower Management",
    items: [
      "Coordinate contract manpower requirements and deployment plans with concerned departments and approved contractors.",
      "Review contractor employee records, joining formalities, attendance and statutory documents before deployment.",
      "Monitor contract manpower availability, replacement requirements and contractor service performance.",
      "Coordinate wage and statutory compliance documentation with contractors and the responsible internal team.",
      "Ensure emergencies involving contract workers are promptly reported and appropriate first aid or medical assistance is arranged.",
    ],
  },
  {
    code: "5",
    title: "Induction, Training and Development",
    items: [
      "Coordinate induction for new joiners and ensure completion of required joining and policy acknowledgements.",
      "Coordinate induction again when apprentices or trainees are moved to company payroll, as applicable to the approved process.",
      "Prepare and monitor the annual training calendar with department heads and Quality Assurance.",
      "Track cGMP, safety, fire safety, emergency response, first-aid and refresher training completion.",
      "Review training records and effectiveness feedback and follow up on pending or corrective actions.",
    ],
  },
  {
    code: "6",
    title: "Medical Examination and Health Records",
    items: [
      "Coordinate pre-employment and periodic medical examinations for employees and other personnel as applicable.",
      "Track medical fitness certificates and follow up on pending examinations before joining or deployment.",
      "Coordinate with authorized medical practitioners and concerned departments to close documentation gaps.",
      "Maintain confidential medical fitness records and restrict access to authorized personnel.",
      "Escalate fitness-related restrictions or overdue cases to the Manager and authorized departments while protecting confidentiality.",
    ],
  },
  {
    code: "7",
    title: "Attendance, Time Office and Payroll",
    items: [
      "Review daily attendance, late arrival, absenteeism, overtime, shift attendance and leave records.",
      "Coordinate attendance corrections with employees, supervisors and department heads before payroll cut-off.",
      "Check monthly payroll inputs, including attendance, leave, overtime and approved deductions, before submission to Accounts/Finance.",
      "Coordinate resolution of salary discrepancies and maintain records of approvals and corrections.",
      "Coordinate employee bank and payroll master data updates through the approved process.",
      "Coordinate EPF/ESIC contribution data and supporting documents with the responsible team and track pending items.",
    ],
  },
  {
    code: "8",
    title: "Benefits, Welfare and Engagement",
    items: [
      "Coordinate employee benefits, welfare schemes and engagement activities within approved policy and budget.",
      "Respond to employee queries about salary, leave, benefits and HR procedures or refer matters to the appropriate team.",
      "Collect employee feedback and identify recurring welfare concerns for review by the Manager.",
      "Coordinate recognition, appreciation and employee communication activities after required approval.",
      "Maintain accurate records of benefit enrollment and welfare or engagement activities.",
    ],
  },
  {
    code: "9",
    title: "Employee Relations, Grievances and Discipline",
    items: [
      "Receive, document and review employee grievances and coordinate fact-finding with relevant departments.",
      "Support fair and timely grievance resolution in consultation with the Manager and department heads.",
      "Guide supervisors on routine employee relations issues and approved disciplinary procedures.",
      "Maintain confidentiality and complete records for grievances, counselling and disciplinary matters.",
      "Escalate serious, sensitive or repeated employee issues to the Manager without delay.",
    ],
  },
  {
    code: "10",
    title: "Separation and Exit Management",
    items: [
      "Coordinate resignations, notice-period tracking, departmental clearance and No Dues documentation.",
      "Follow up on handover of company property, documents, identity cards and access credentials.",
      "Verify leave balance, advances, recoveries and other approved inputs for Full and Final settlement with Accounts/Finance.",
      "Prepare relieving and experience letters only after required authorization.",
      "Conduct or coordinate exit interviews, maintain separation records and report recurring feedback trends to the Manager.",
    ],
  },
  {
    code: "11",
    title: "HR Policies, SOPs and Documentation",
    items: [
      "Prepare and review HR policy and SOP drafts and coordinate document-control approvals.",
      "Monitor implementation of approved HR policies and communicate revisions to concerned employees and departments.",
      "Check employee personal files, appointment and transfer letters, promotion records, training files and attendance documentation.",
      "Ensure HR records are properly filed, retrievable, retained and protected from unauthorized access.",
      "Track documentation gaps and corrective actions arising from internal reviews or audits.",
    ],
  },
  {
    code: "12",
    title: "Factory, Labour Law and Statutory Compliance",
    items: [
      "Maintain and monitor the HR/Admin compliance calendar, statutory registers, notices, returns and renewal records assigned to the role.",
      "Coordinate factory licence renewal documentation and statutory submissions with authorized personnel or consultants.",
      "Coordinate EPF/ESIC records, labour contractor documents and supporting evidence with the responsible team.",
      "Support inspections, audits and responses to observations; track corrective actions and due dates.",
      "Escalate missed deadlines, non-compliance risks, workplace accidents and significant inspection observations to the Manager promptly.",
    ],
  },
  {
    code: "13",
    title: "General Administration, Security and Facilities",
    items: [
      "Coordinate daily administration, security, visitor management, access control and facility-related activities.",
      "Monitor housekeeping, canteen, hygiene, sanitation, pest control, first-aid and fire-safety arrangements.",
      "Follow up on maintenance requests, service-provider performance and closure of reported facility issues.",
      "Coordinate emergency drills and maintain related attendance, incident and corrective-action records.",
      "Report security incidents, safety concerns and recurring service issues to the Manager.",
    ],
  },
  {
    code: "14",
    title: "General Responsibility",
    items: [
      "Supervise assigned HR and Administration activities and ensure timely completion of tasks by the team.",
      "Ensure work is performed according to approved company policies, SOPs, delegated authority and applicable requirements.",
      "Prepare periodic status reports on manpower, recruitment, attendance/payroll, training, compliance and administration.",
      "Recommend process improvements to the Manager and follow through on approved corrective actions.",
      "Perform other HR and Administration duties assigned by the Manager or authorized management.",
    ],
  },
]);

const assistantManagerHr = buildDesignation("hr-assistant-manager", "Assistant Manager HR", [
  {
    code: "1",
    title: "Role Purpose",
    items: [
      "Supervise day-to-day HR and administration delivery, review controls and resolve operational issues within delegated authority.",
    ],
  },
  {
    code: "2",
    title: "Human Resource Planning and Organization",
    items: [
      "Review manpower plans, headcount and utilization with department heads against production requirements and approved budget.",
      "Lead periodic review of organization structure, job descriptions, accountability and reporting relationships.",
      "Recommend staffing, transfer, promotion and organization changes for management approval.",
    ],
  },
  {
    code: "3",
    title: "Recruitment and Selection",
    items: [
      "Supervise recruitment delivery for assigned functions and ensure selection follows approved procedures.",
      "Review critical vacancies, candidate evaluation, offer recommendations and recruitment agency performance.",
      "Monitor recruitment KPIs and resolve delays with department heads.",
    ],
  },
  {
    code: "4",
    title: "Contract Manpower Management",
    items: [
      "Review contract manpower plans, contractor performance, availability and deployment risks.",
      "Ensure joining, attendance, wage and statutory documentation controls are followed.",
      "Coordinate corrective actions for contractor gaps and escalate serious compliance or safety issues.",
    ],
  },
  {
    code: "5",
    title: "Induction, Training and Development",
    items: [
      "Review the annual training calendar with department heads and QA and monitor completion of mandatory training.",
      "Ensure induction, cGMP, safety and refresher training programmes are effective and documented.",
      "Review training effectiveness and initiate follow-up actions with concerned departments.",
    ],
  },
  {
    code: "6",
    title: "Medical Examination and Health Records",
    items: [
      "Oversee medical examination schedules and ensure required fitness clearances are completed before deployment.",
      "Review pending cases and coordinate corrective action with authorized medical providers and departments.",
      "Ensure confidentiality and controlled access to medical fitness information.",
    ],
  },
  {
    code: "7",
    title: "Attendance, Time Office and Payroll",
    items: [
      "Review monthly attendance and payroll inputs, overtime, leave, deductions and exception reports before submission.",
      "Coordinate payroll reconciliation with Accounts/Finance and monitor timely resolution of discrepancies.",
      "Oversee EPF/ESIC data coordination and ensure records and approvals are maintained.",
    ],
  },
  {
    code: "8",
    title: "Benefits, Welfare and Engagement",
    items: [
      "Oversee benefit administration, employee welfare and engagement programmes within approved policy and budget.",
      "Review employee concerns and engagement feedback and recommend practical improvements.",
      "Coordinate communication between employees, supervisors and management.",
    ],
  },
  {
    code: "9",
    title: "Employee Relations, Grievances and Discipline",
    items: [
      "Review significant grievances and coordinate impartial investigations and resolution with department heads.",
      "Guide supervisors on employee relations and disciplinary procedures in line with policy and applicable law.",
      "Ensure documentation, confidentiality and timely escalation of serious matters.",
    ],
  },
  {
    code: "10",
    title: "Separation and Exit Management",
    items: [
      "Review separation cases, clearances, handover and F&F inputs for completeness and timely closure.",
      "Monitor exit interview trends and recommend retention or process improvements.",
      "Ensure relieving/experience letters are issued only after required authorization.",
    ],
  },
  {
    code: "11",
    title: "HR Policies, SOPs and Documentation",
    items: [
      "Review HR policy and SOP drafts, coordinate approvals and monitor implementation.",
      "Conduct periodic checks of employee files, records, retention and confidentiality controls.",
      "Track corrective actions for documentation gaps and ensure approved revisions are communicated.",
    ],
  },
  {
    code: "12",
    title: "Factory, Labour Law and Statutory Compliance",
    items: [
      "Monitor statutory compliance calendar, licence renewals, registers, returns and contribution requirements.",
      "Coordinate with consultants, government departments and internal teams for inspections and audits.",
      "Review compliance gaps, accident reporting and corrective actions; escalate significant risks to the Manager.",
    ],
  },
  {
    code: "13",
    title: "General Administration, Security and Facilities",
    items: [
      "Supervise routine administration, security, visitor/access controls and incident follow-up.",
      "Review canteen, housekeeping, hygiene, first-aid, fire safety, pest control and sanitation performance.",
      "Coordinate emergency drills and ensure service-provider issues are corrected promptly.",
    ],
  },
  {
    code: "14",
    title: "General Responsibility",
    items: [
      "Ensure team activities follow approved policies, SOPs and applicable requirements; monitor records, timelines and corrective actions and escalate material risks.",
    ],
  },
]);

const RESPONSIBILITY_CATALOG: CatalogDepartment[] = [
  {
    id: "hr",
    matchers: ["hr", "hrd", "human resources", "human resource", "personnel"],
    designations: [officerHr, executiveHr, managerHr, deputyManagerHr, assistantManagerHr],
  },
  {
    id: "qa",
    matchers: ["qa", "quality assurance"],
    sections: QA_SECTIONS,
  },
  {
    id: "production",
    matchers: ["production", "prd"],
    sections: PRODUCTION_SECTIONS,
  },
  {
    id: "ipqa",
    matchers: ["ipqa", "in process qa"],
    sections: IPQA_SECTIONS,
  },
  {
    id: "qc",
    matchers: ["qc", "quality control"],
    sections: QC_SECTIONS,
  },
];

export function departmentHasResponsibilityCatalog(dept: {
  name: string;
  code: string;
}): boolean {
  return Boolean(catalogForDepartment(dept));
}

export function sectionsForDepartment(dept: { name: string; code: string }): string[] {
  return catalogForDepartment(dept)?.sections?.map((section) => section.name) ?? [];
}

export function designationsForDepartment(
  dept: { name: string; code: string },
  sectionName?: string
): JdDesignationResponsibilities[] {
  const entry = catalogForDepartment(dept);
  if (!entry) return [];
  if (entry.sections?.length) {
    const wanted = norm(sectionName || "");
    if (!wanted) return [];
    return entry.sections.find((section) => norm(section.name) === wanted)?.designations ?? [];
  }
  return entry.designations ?? [];
}

export function findDesignation(
  dept: { name: string; code: string },
  title: string,
  sectionName?: string
): JdDesignationResponsibilities | undefined {
  const wanted = norm(title);
  if (!wanted) return undefined;
  return designationsForDepartment(dept, sectionName).find(
    (row) => norm(row.designation) === wanted
  );
}

export function formatCatalogResponsibility(
  group: JdResponsibilityGroup,
  line: JdResponsibilityLine
): string {
  const prefix = line.code ? `${line.code} ` : "";
  return `${group.title}: ${prefix}${line.text}`;
}

export function allResponsibilityLines(
  designation: JdDesignationResponsibilities
): { id: string; label: string }[] {
  return designation.groups.flatMap((group) =>
    group.lines.map((line) => ({
      id: line.id,
      label: formatCatalogResponsibility(group, line),
    }))
  );
}

export function selectedResponsibilityTexts(
  designation: JdDesignationResponsibilities,
  selectedIds: Iterable<string>
): string[] {
  const selected = new Set(selectedIds);
  return allResponsibilityLines(designation)
    .filter((line) => selected.has(line.id))
    .map((line) => line.label);
}

/** Restore checkbox state from responsibilities already saved on a JD. */
export function matchSavedResponsibilities(
  designation: JdDesignationResponsibilities,
  saved: string[]
): { ids: string[]; extra: string[] } {
  const lines = allResponsibilityLines(designation);
  const used = new Set<string>();
  const ids: string[] = [];
  const extra: string[] = [];

  for (const raw of saved) {
    const savedNorm = norm(raw);
    const hit = lines.find((line) => {
      if (used.has(line.id)) return false;
      const labelNorm = norm(line.label);
      const text = designation.groups
        .flatMap((group) => group.lines)
        .find((row) => row.id === line.id)?.text;
      return savedNorm === labelNorm || (text ? savedNorm === norm(text) : false);
    });
    if (hit) {
      used.add(hit.id);
      ids.push(hit.id);
    } else if (raw.trim()) {
      extra.push(raw.trim());
    }
  }

  return { ids, extra };
}

export interface JdCatalogSnapshot {
  sections: JdCatalogSection[];
  designations: JdDesignationResponsibilities[];
}

function cloneCatalog<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Built-in lists for a department. A copy, so edits do not change the original. */
export function builtinCatalogSnapshot(dept: { name: string; code: string }): JdCatalogSnapshot {
  const entry = catalogForDepartment(dept);
  return {
    sections: entry?.sections ? cloneCatalog(entry.sections) : [],
    designations: entry?.designations ? cloneCatalog(entry.designations) : [],
  };
}

export function sectionsFromSnapshot(snapshot: JdCatalogSnapshot): string[] {
  return snapshot.sections.map((section) => section.name);
}

export function designationsFromSnapshot(
  snapshot: JdCatalogSnapshot,
  sectionName?: string
): JdDesignationResponsibilities[] {
  if (snapshot.sections.length) {
    const wanted = norm(sectionName || "");
    if (!wanted) return [];
    return (
      snapshot.sections.find((section) => norm(section.name) === wanted)?.designations ?? []
    );
  }
  return snapshot.designations;
}

export function findDesignationInSnapshot(
  snapshot: JdCatalogSnapshot,
  title: string,
  sectionName?: string
): JdDesignationResponsibilities | undefined {
  const wanted = norm(title);
  if (!wanted) return undefined;
  return designationsFromSnapshot(snapshot, sectionName).find(
    (row) => norm(row.designation) === wanted
  );
}

function catalogForDepartment(dept: { name: string; code: string }): CatalogDepartment | undefined {
  const name = norm(dept.name);
  const code = norm(dept.code);
  return RESPONSIBILITY_CATALOG.find((entry) =>
    entry.matchers.some((raw) => {
      const matcher = norm(raw);
      if (!matcher) return false;
      if (code === matcher || name === matcher) return true;
      // Short codes ("qa", "hr") match only the whole code or name. A prefix
      // would treat QA Microbiology / QAM as Quality Assurance, and a later
      // word would treat In-Process QA as Quality Assurance.
      if (matcher.length < 3) return false;
      return name.includes(matcher);
    })
  );
}
