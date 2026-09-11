import type { Employee } from "@/types";
import type { OjtAssignment, OjtFormDocument, OjtPlan, OjtSettings } from "@/types/ojt";
import { CALENDAR_MONTHS, formatOfficialDate, formatRevisionNumber } from "@/lib/ojt/constants";
import { latestSignoff } from "@/lib/ojt/forms";
import {
  employeeDisplayName,
  officialExecutionLabel,
  officialSelectionLabel,
  officialSelectionValue,
} from "@/lib/ojt/matrix";
import { escapeHtml, printHtml } from "@/lib/print";

function signLine(doc: OjtFormDocument | null, role: Parameters<typeof latestSignoff>[1]) {
  const s = doc ? latestSignoff(doc, role) : undefined;
  if (!s) return "Sign &amp; Date";
  return `${escapeHtml(s.userName)} · ${formatOfficialDate(s.timestamp)}`;
}

function sheetCss() {
  return `
    @page { size: A4 landscape; margin: 10mm; }
    body { margin: 0; font-family: "Times New Roman", serif; color: #111; background: #fff; }
    .sheet { width: 100%; box-sizing: border-box; }
    .header-table, .meta, .grid, .legend, .signatures, .footer-table { width: 100%; border-collapse: collapse; }
    .header-table td { border: 1px solid #333; padding: 4px 8px; vertical-align: middle; }
    .logo-cell { width: 90px; text-align: center; }
    .logo-cell img { width: 68px; height: auto; }
    .title-1, .title-2, .title-3 { text-align: center; font-weight: 700; }
    .title-1 { font-size: 16px; }
    .title-2 { font-size: 14px; }
    .title-3 { font-size: 15px; letter-spacing: 0.4px; }
    .meta td { border: 1px solid #333; padding: 4px 8px; font-size: 12px; }
    .grid th, .grid td { border: 1px solid #333; padding: 3px 4px; font-size: 10px; vertical-align: middle; }
    .grid th { text-align: center; font-weight: 700; background: #f4f4f4; }
    .center { text-align: center; }
    .topic { text-align: left; }
    .row-label { font-weight: 700; width: 28px; text-align: center; }
    .tick { font-weight: 700; }
    .legend td { border: none; padding: 8px 4px 4px; font-size: 11px; }
    .note { font-size: 11px; margin: 6px 0 10px; }
    .signatures td { border: 1px solid #333; padding: 8px; font-size: 11px; vertical-align: top; width: 33.33%; height: 72px; }
    .sig-title { font-weight: 700; }
    .sig-role { margin-bottom: 18px; }
    .footer-table td { border: none; padding-top: 8px; font-size: 11px; }
    .sticky-note { font-size: 10px; color: #444; }
  `;
}

function companyHeader(args: {
  settings: OjtSettings;
  title: string;
  logoSrc?: string;
}) {
  const logo = args.logoSrc
    ? `<img src="${escapeHtml(args.logoSrc)}" alt="Company logo" />`
    : "";
  return `
    <table class="header-table">
      <tr>
        <td class="logo-cell" rowspan="3">${logo}</td>
        <td class="title-1">${escapeHtml(args.settings.companyName)}</td>
      </tr>
      <tr><td class="title-2">${escapeHtml(args.settings.companyDivision)}</td></tr>
      <tr><td class="title-3">${escapeHtml(args.title)}</td></tr>
    </table>
  `;
}

export function printOjtPlannerForm(args: {
  plans: OjtPlan[];
  departmentName: string;
  year: number;
  settings: OjtSettings;
  form?: OjtFormDocument | null;
  logoSrc?: string;
}) {
  const { plans, departmentName, year, settings, form } = args;
  const effective = form?.effectiveDate ? formatOfficialDate(form.effectiveDate) : "";
  const revision = formatRevisionNumber(form?.revisionNumber || "00");
  const formNo = form?.formNumber || settings.plannerFormNumber;

  const body = plans
    .map((plan, index) => {
      const sop = escapeHtml(plan.referenceDocumentNumber || plan.sopNumber || "NA");
      const topic = escapeHtml(plan.trainingTopic);
      const sCells = CALENDAR_MONTHS.map((m) => {
        const on = plan.selectionMonths.includes(m.number);
        return `<td class="center tick">${on ? "✓" : ""}</td>`;
      }).join("");
      const eCells = CALENDAR_MONTHS.map((m) => {
        const on = plan.executionMonths.includes(m.number);
        return `<td class="center tick">${on ? "✓" : ""}</td>`;
      }).join("");
      return `
        <tr>
          <td class="center" rowspan="2">${index + 1}</td>
          <td class="topic" rowspan="2">${topic}</td>
          <td class="center" rowspan="2">${sop}</td>
          <td class="row-label">S</td>
          ${sCells}
        </tr>
        <tr>
          <td class="row-label">E</td>
          ${eCells}
        </tr>
      `;
    })
    .join("");

  const monthHeads = CALENDAR_MONTHS.map((m) => `<th>${escapeHtml(m.name)}</th>`).join("");

  const html = `
    <!doctype html>
    <html>
      <head>
        <title>OJT Planner ${escapeHtml(departmentName)} ${year}</title>
        <style>${sheetCss()}</style>
      </head>
      <body>
        <div class="sheet">
          ${companyHeader({ settings, title: "ON JOB TRAINING PLANNER", logoSrc: args.logoSrc })}
          <table class="meta">
            <tr>
              <td><b>Department:</b> ${escapeHtml(departmentName)}</td>
              <td><b>Year:</b> ${year}</td>
              <td><b>Effective Date:</b> ${escapeHtml(effective || "—")}</td>
              <td><b>Revision No.:</b> ${escapeHtml(revision)}</td>
            </tr>
          </table>
          <table class="grid">
            <thead>
              <tr>
                <th>S. No.</th>
                <th>Training Topic</th>
                <th>SOP No. / Reference Document No.</th>
                <th>S/E</th>
                ${monthHeads}
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
          <table class="legend">
            <tr>
              <td>S = Selection of Month &nbsp;&nbsp; E = Execution Months</td>
            </tr>
          </table>
          <table class="signatures">
            <tr>
              <td>
                <div class="sig-title">Checked By</div>
                <div class="sig-role">Department Training Coordinator</div>
                <div>${signLine(form || null, "checked_by_coordinator")}</div>
              </td>
              <td>
                <div class="sig-title">Verified By</div>
                <div class="sig-role">Department HOD/Designee</div>
                <div>${signLine(form || null, "verified_by_hod")}</div>
              </td>
              <td>
                <div class="sig-title">Prepared By</div>
                <div class="sig-role">Officer/Executive</div>
                <div>${signLine(form || null, "prepared_by")}</div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="sig-title">Checked By</div>
                <div class="sig-role">Department Head</div>
                <div>${signLine(form || null, "checked_by_head")}</div>
              </td>
              <td colspan="2">
                <div class="sig-title">Approved By</div>
                <div class="sig-role">Head QA</div>
                <div>${signLine(form || null, "approved_by_qa")}</div>
              </td>
            </tr>
          </table>
          <table class="footer-table">
            <tr>
              <td>FORMAT No.: ${escapeHtml(formNo)}</td>
              <td class="center">Page 1 of 1</td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;
  printHtml(html, `OJT Planner ${departmentName} ${year}`);
}

export function printOjtMatrixForm(args: {
  plans: OjtPlan[];
  employees: Employee[];
  assignments: OjtAssignment[];
  departmentName: string;
  year: number;
  settings: OjtSettings;
  form?: OjtFormDocument | null;
  logoSrc?: string;
}) {
  const { plans, employees, assignments, departmentName, year, settings, form } = args;
  const effective = form?.effectiveDate ? formatOfficialDate(form.effectiveDate) : "";
  const revision = formatRevisionNumber(form?.revisionNumber || "00");
  const formNo = form?.formNumber || settings.matrixFormNumber;

  const empHeads = employees
    .map(
      (e) =>
        `<th><div>${escapeHtml(employeeDisplayName(e))}</div><div class="sticky-note">${escapeHtml(e.employeeCode)}</div></th>`
    )
    .join("");

  const body = plans
    .map((plan, index) => {
      const sop = escapeHtml(plan.referenceDocumentNumber || plan.sopNumber || "NA");
      const sCells = employees
        .map((emp) => {
          const value = officialSelectionValue(plan, emp.id);
          return `<td class="center tick">${escapeHtml(officialSelectionLabel(value))}</td>`;
        })
        .join("");
      const eCells = employees
        .map((emp) => {
          const asg = assignments.find(
            (a) => a.employeeId === emp.id && a.topicId === plan.topicId && a.year === year && a.status !== "cancelled"
          );
          return `<td class="center">${escapeHtml(officialExecutionLabel(plan, asg, emp.id))}</td>`;
        })
        .join("");
      return `
        <tr>
          <td class="center" rowspan="2">${index + 1}</td>
          <td class="topic" rowspan="2">${escapeHtml(plan.trainingTopic)}</td>
          <td class="center" rowspan="2">${sop}</td>
          <td class="row-label">S</td>
          ${sCells}
        </tr>
        <tr>
          <td class="row-label">E</td>
          ${eCells}
        </tr>
      `;
    })
    .join("");

  const html = `
    <!doctype html>
    <html>
      <head>
        <title>Employee Training Matrix ${escapeHtml(departmentName)} ${year}</title>
        <style>${sheetCss()}</style>
      </head>
      <body>
        <div class="sheet">
          ${companyHeader({ settings, title: "EMPLOYEE TRAINING MATRIX", logoSrc: args.logoSrc })}
          <table class="meta">
            <tr>
              <td><b>Department:</b> ${escapeHtml(departmentName)}</td>
              <td><b>Year:</b> ${year}</td>
              <td><b>Effective Date:</b> ${escapeHtml(effective || "—")}</td>
              <td><b>Revision No.:</b> ${escapeHtml(revision)}</td>
            </tr>
          </table>
          <table class="grid">
            <thead>
              <tr>
                <th>S. No.</th>
                <th>Training Topic</th>
                <th>SOP No. / Reference Document No.</th>
                <th>S/E</th>
                ${empHeads}
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
          <div class="note">
            S = Selection of Employee &nbsp;&nbsp; E = Execution date of training<br />
            Training shall be imparted on current version of SOP.
          </div>
          <table class="signatures">
            <tr>
              <td>
                <div class="sig-title">Prepared By</div>
                <div class="sig-role">Officer/Executive</div>
                <div>${signLine(form || null, "prepared_by")}</div>
              </td>
              <td>
                <div class="sig-title">Checked By</div>
                <div class="sig-role">Department Head</div>
                <div>${signLine(form || null, "checked_by_head")}</div>
              </td>
              <td>
                <div class="sig-title">Approved By</div>
                <div class="sig-role">Head QA</div>
                <div>${signLine(form || null, "approved_by_qa")}</div>
              </td>
            </tr>
          </table>
          <table class="footer-table">
            <tr>
              <td>FORMAT No.: ${escapeHtml(formNo)}</td>
              <td class="center">Page 1 of 1</td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;
  printHtml(html, `Employee Training Matrix ${departmentName} ${year}`);
}
