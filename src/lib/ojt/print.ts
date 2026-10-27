import type { Employee } from "@/types";
import type { OjtAssignment, OjtFormDocument, OjtFormSignoffRole, OjtPlan, OjtSettings } from "@/types/ojt";
import { CALENDAR_MONTHS, formatOfficialDate, formatRevisionNumber } from "@/lib/ojt/constants";
import { latestSignoff } from "@/lib/ojt/forms";
import {
  officialExecutionLabel,
  officialSelectionLabel,
  officialSelectionValue,
} from "@/lib/ojt/matrix";
import { escapeHtml, printHtml } from "@/lib/print";

const PLANNER_LEGEND =
  "S=Selection of month (Tick “✓ mark for the applicable month) : E = Execution month (Tick “✓ mark for the execution month)";
const MATRIX_LEGEND =
  "S- Selection of Employee (Tick “✓ mark for the applicable employee for particular SOP training/topic); E- Execution date of training.";
const MATRIX_NOTE = "Training shall be imparted on current version of SOP.";

function electronicSignature(
  doc: OjtFormDocument | null | undefined,
  role: OjtFormSignoffRole
): string {
  const s = doc ? latestSignoff(doc, role) : undefined;
  if (!s || s.action === "rejected") {
    return `<div class="sign-pending">Electronic signature pending</div>`;
  }
  const drawn = s.signatureDataUrl
    ? `<img class="sign-img" src="${escapeHtml(s.signatureDataUrl)}" alt="" />`
    : `<div class="sign-esign">${escapeHtml(s.userName)}</div>`;
  return `
    ${drawn}
    <div class="sign-note">Electronically computer-generated signature</div>
    <div class="sign-date">${escapeHtml(formatOfficialDate(s.timestamp))}</div>
  `;
}

/** Split rows so a full page matches the official form and the last page keeps the signature block. */
function pageSizes(count: number, full: number, lastMax: number): number[] {
  if (count <= 0) return [0];
  if (count <= lastMax) return [count];
  const sizes: number[] = [];
  let left = count;
  while (left > lastMax) {
    if (left <= full) {
      sizes.push(left - lastMax);
      left = lastMax;
      break;
    }
    sizes.push(full);
    left -= full;
  }
  if (left > 0) sizes.push(left);
  return sizes;
}

function sheetCss(): string {
  return `
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .sheet {
      width: 297mm;
      height: 210mm;
      padding: 4mm 5mm 3.5mm;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      display: flex;
    }
    .sheet:last-child { page-break-after: auto; break-after: auto; }
    .frame {
      flex: 1;
      min-height: 0;
      border: 1px solid #000;
      display: flex;
      flex-direction: column;
      padding: 0;
    }
    .banner, .meta, .grid { width: 100%; border-collapse: collapse; }
    .banner td {
      border: 1px solid #000;
      text-align: center;
      font-weight: 700;
      padding: 1px 6px;
      line-height: 1.25;
    }
    .logo-cell { width: 78px; vertical-align: middle; }
    .logo-cell img { width: 62px; height: auto; display: block; margin: 0 auto; }
    .title-1 { font-size: 15px; letter-spacing: 0.2px; }
    .title-2 { font-size: 13px; }
    .title-3 { font-size: 13px; letter-spacing: 0.3px; }
    .meta td { border: none; padding: 1px 6px 2px; font-size: 12px; font-weight: 700; }
    .meta .right { text-align: right; }
    .grid th, .grid td {
      border: 1px solid #000;
      padding: 2px 3px;
      font-size: 10px;
      vertical-align: middle;
      line-height: 1.15;
    }
    .grid.fill { flex: 1 1 auto; height: 100%; }
    .planner .grid.fill tbody td { height: 8.2mm; }
    .matrix .grid.fill tbody td { height: 11mm; }
    .grid th {
      background: #d9d9d9;
      font-weight: 700;
      text-align: center;
    }
    .hwrap { padding: 3px 2px; }
    th.month, th.emp { vertical-align: bottom; padding: 2px 0 3px; height: 72px; }
    .vhead {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      white-space: nowrap;
      display: inline-block;
      font-weight: 700;
      font-size: 10px;
      line-height: 1.05;
      text-align: left;
    }
    .vhead .code { display: block; font-size: 9px; font-weight: 700; }
    .center { text-align: center; }
    .topic { text-align: left; font-size: 10px; }
    .se { font-weight: 700; text-align: center; }
    .tick { font-weight: 700; font-size: 11px; }
    .sign-row td { height: auto; min-height: 28px; font-size: 11px; font-weight: 700; text-align: center; padding: 4px 6px; }
    .sign-esign {
      font-family: "Segoe Script", "Lucida Handwriting", "Brush Script MT", cursive;
      font-size: 16px;
      font-weight: 400;
      color: #1a365d;
      line-height: 1.15;
      margin-top: 2px;
    }
    .sign-img { height: 26px; width: auto; display: block; margin: 2px auto 0; }
    .sign-note { font-size: 9px; font-style: italic; font-weight: 400; color: #333; }
    .sign-date { font-size: 10px; font-weight: 700; }
    .sign-pending { font-size: 10px; font-style: italic; font-weight: 400; color: #444; margin-top: 2px; }
    .after {
      padding: 6px 8px 0;
      page-break-inside: avoid;
    }
    .legend { font-size: 11px; line-height: 1.35; margin: 0; }
    .signs {
      display: flex;
      justify-content: space-around;
      text-align: center;
      font-weight: 700;
      font-size: 12px;
      line-height: 1.35;
      margin-top: 18px;
    }
    .signs .sign-esign { margin-top: 6px; }
    .footer {
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 3px 6px 2px;
      font-size: 11px;
    }
  `;
}

function companyHeader(args: { settings: OjtSettings; title: string; logoSrc?: string }): string {
  const logo = args.logoSrc
    ? `<img src="${escapeHtml(args.logoSrc)}" alt="SKYMAP" />`
    : "";
  return `
    <table class="banner">
      <tr>
        <td class="logo-cell" rowspan="3">${logo}</td>
        <td class="title-1">${escapeHtml(args.settings.companyName)}</td>
      </tr>
      <tr><td class="title-2">${escapeHtml(args.settings.companyDivision)}</td></tr>
      <tr><td class="title-3">${escapeHtml(args.title)}</td></tr>
    </table>
  `;
}

function metaRow(args: {
  departmentName: string;
  year: number;
  effective: string;
  revision: string;
}): string {
  return `
    <table class="meta">
      <tr>
        <td>Department: ${escapeHtml(args.departmentName)}</td>
        <td class="right">Year: ${args.year}</td>
      </tr>
      <tr>
        <td>Effective Date: ${escapeHtml(args.effective)}</td>
        <td class="right">Revision No.: ${escapeHtml(args.revision)}</td>
      </tr>
    </table>
  `;
}

function footerRow(formNo: string, page: number, pages: number): string {
  return `
    <div class="footer">
      <span>FORMAT No. ${escapeHtml(formNo)}</span>
      <span>Page ${page} of ${pages}</span>
    </div>
  `;
}

function approvalBlock(form: OjtFormDocument | null | undefined): string {
  const cell = (title: string, roleLine: string, role: OjtFormSignoffRole) => `
    <div>
      <div>${title}</div>
      <div>${roleLine}</div>
      ${electronicSignature(form, role)}
    </div>
  `;
  return `
    <div class="signs">
      ${cell("Prepared By", "Officer/Executive", "prepared_by")}
      ${cell("Checked By", "Department Head", "checked_by_head")}
      ${cell("Approved By", "Head QA", "approved_by_qa")}
    </div>
  `;
}

function employeeHead(employee: Employee): string {
  const name = employee.firstName?.trim() || `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
  return `<th class="emp"><div class="vhead">${escapeHtml(name)}<span class="code">${escapeHtml(employee.employeeCode || "")}</span></div></th>`;
}

function wrapDocument(title: string, kind: "planner" | "matrix", body: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${sheetCss()}</style>
  </head>
  <body class="${kind}">${body}</body>
</html>`;
}

export function renderOjtPlannerHtml(args: {
  plans: OjtPlan[];
  departmentName: string;
  year: number;
  settings: OjtSettings;
  form?: OjtFormDocument | null;
  logoSrc?: string;
}): string {
  const { plans, departmentName, year, settings, form } = args;
  const effective = form?.effectiveDate ? formatOfficialDate(form.effectiveDate) : "";
  const revision = formatRevisionNumber(form?.revisionNumber || "00");
  const formNo = form?.formNumber || settings.plannerFormNumber;
  const sizes = pageSizes(plans.length, 7, 4);
  const pages = sizes.length;
  const monthHeads = CALENDAR_MONTHS.map(
    (m) => `<th class="month"><div class="vhead">${escapeHtml(m.name)}</div></th>`
  ).join("");
  const head = `
    ${companyHeader({ settings, title: "ON JOB TRAINING PLANNER", logoSrc: args.logoSrc })}
    ${metaRow({ departmentName, year, effective, revision })}
  `;
  const colHead = `
    <tr>
      <th class="hwrap" rowspan="2" style="width:4%">S.<br>No.</th>
      <th class="hwrap" rowspan="2" style="width:16%">Training Topic</th>
      <th class="hwrap" rowspan="2" style="width:11%">SOP No./<br>Reference<br>Document No.</th>
      <th class="hwrap" rowspan="2" style="width:8%">Selection of<br>Month/<br>Execution</th>
      <th class="hwrap" colspan="12">Months</th>
    </tr>
    <tr>${monthHeads}</tr>
  `;

  let cursor = 0;
  const sheets = sizes.map((size, pageIndex) => {
    const slice = plans.slice(cursor, cursor + size);
    const start = cursor;
    cursor += size;
    const last = pageIndex === pages - 1;
    const fill = !last && size >= 6 ? " fill" : "";
    const body = slice
      .map((plan, index) => {
        const sop = escapeHtml(plan.referenceDocumentNumber || plan.sopNumber || "NA");
        const sCells = CALENDAR_MONTHS.map((m) => {
          const on = plan.selectionMonths.includes(m.number);
          return `<td class="center tick">${on ? "✓" : "NA"}</td>`;
        }).join("");
        const eCells = CALENDAR_MONTHS.map((m) => {
          const on = plan.executionMonths.includes(m.number);
          return `<td class="center tick">${on ? "✓" : ""}</td>`;
        }).join("");
        return `
          <tr>
            <td class="center" rowspan="2">${start + index + 1}.</td>
            <td class="topic" rowspan="2">${escapeHtml(plan.trainingTopic)}</td>
            <td class="center" rowspan="2">${sop}</td>
            <td class="se">S</td>
            ${sCells}
          </tr>
          <tr>
            <td class="se">E</td>
            ${eCells}
          </tr>
        `;
      })
      .join("");

    const closingRows = last
      ? `
        <tr class="sign-row">
          <td colspan="4">Checked By Department Training Coordinator${electronicSignature(form, "checked_by_coordinator")}</td>
          ${CALENDAR_MONTHS.map(() => "<td></td>").join("")}
        </tr>
        <tr class="sign-row">
          <td colspan="4">Verified By Department HOD/Designee${electronicSignature(form, "verified_by_hod")}</td>
          ${CALENDAR_MONTHS.map(() => "<td></td>").join("")}
        </tr>
      `
      : "";

    const after = last
      ? `<div class="after"><p class="legend">${PLANNER_LEGEND}</p>${approvalBlock(form)}</div>`
      : "";

    return `
      <section class="sheet">
        <div class="frame">
          ${head}
          <table class="grid${fill}">
            <thead>${colHead}</thead>
            <tbody>${body}${closingRows}</tbody>
          </table>
          ${after}
          ${footerRow(formNo, pageIndex + 1, pages)}
        </div>
      </section>
    `;
  });

  return wrapDocument(`OJT Planner ${departmentName} ${year}`, "planner", sheets.join(""));
}

export function printOjtPlannerForm(args: {
  plans: OjtPlan[];
  departmentName: string;
  year: number;
  settings: OjtSettings;
  form?: OjtFormDocument | null;
  logoSrc?: string;
}) {
  printHtml(renderOjtPlannerHtml(args), `OJT Planner ${args.departmentName} ${args.year}`);
}

export function renderOjtMatrixHtml(args: {
  plans: OjtPlan[];
  employees: Employee[];
  assignments: OjtAssignment[];
  departmentName: string;
  year: number;
  settings: OjtSettings;
  form?: OjtFormDocument | null;
  logoSrc?: string;
}): string {
  const { plans, employees, assignments, departmentName, year, settings, form } = args;
  const effective = form?.effectiveDate ? formatOfficialDate(form.effectiveDate) : "";
  const revision = formatRevisionNumber(form?.revisionNumber || "00");
  const formNo = form?.formNumber || settings.matrixFormNumber;
  const full = employees.length > 16 ? 3 : 4;
  const lastMax = employees.length > 16 ? 2 : 4;
  const sizes = pageSizes(plans.length, full, lastMax);
  const pages = sizes.length;
  const empHeads = employees.map((employee) => employeeHead(employee)).join("");
  const empWidth = employees.length ? `${Math.max(3, Math.floor(62 / employees.length))}%` : "8%";
  const head = `
    ${companyHeader({ settings, title: "EMPLOYEE TRAINING MATRIX", logoSrc: args.logoSrc })}
    ${metaRow({ departmentName, year, effective, revision })}
  `;
  const colHead = `
    <tr>
      <th class="hwrap" rowspan="2" style="width:4%">S.<br>No.</th>
      <th class="hwrap" rowspan="2" style="width:15%">Training Topic</th>
      <th class="hwrap" rowspan="2" style="width:10%">SOP No./<br>Reference<br>Document No.</th>
      <th class="hwrap" rowspan="2" style="width:7%">Selection<br>of<br>Employee/<br>Execution</th>
      <th class="hwrap" colspan="${Math.max(employees.length, 1)}">Name of Employee</th>
    </tr>
    <tr>${empHeads || `<th class="emp"></th>`}</tr>
  `;

  let cursor = 0;
  const sheets = sizes.map((size, pageIndex) => {
    const slice = plans.slice(cursor, cursor + size);
    const start = cursor;
    cursor += size;
    const last = pageIndex === pages - 1;
    const fill = !last && size >= full ? " fill" : "";
    const body = slice
      .map((plan, index) => {
        const sop = escapeHtml(plan.referenceDocumentNumber || plan.sopNumber || "NA");
        const sCells = (employees.length ? employees : [null])
          .map((emp) => {
            if (!emp) return `<td></td>`;
            const value = officialSelectionValue(plan, emp.id);
            return `<td class="center tick" style="width:${empWidth}">${escapeHtml(officialSelectionLabel(value))}</td>`;
          })
          .join("");
        const eCells = (employees.length ? employees : [null])
          .map((emp) => {
            if (!emp) return `<td></td>`;
            const asg = assignments.find(
              (a) =>
                a.employeeId === emp.id &&
                a.topicId === plan.topicId &&
                a.year === year &&
                a.status !== "cancelled"
            );
            return `<td class="center">${escapeHtml(officialExecutionLabel(plan, asg, emp.id))}</td>`;
          })
          .join("");
        return `
          <tr>
            <td class="center" rowspan="2">${start + index + 1}.</td>
            <td class="topic" rowspan="2">${escapeHtml(plan.trainingTopic)}</td>
            <td class="center" rowspan="2">${sop}</td>
            <td class="se">S</td>
            ${sCells}
          </tr>
          <tr>
            <td class="se">E</td>
            ${eCells}
          </tr>
        `;
      })
      .join("");

    const after = last
      ? `<div class="after"><p class="legend">${MATRIX_LEGEND}<br>${MATRIX_NOTE}</p>${approvalBlock(form)}</div>`
      : "";

    return `
      <section class="sheet">
        <div class="frame">
          ${head}
          <table class="grid${fill}">
            <thead>${colHead}</thead>
            <tbody>${body}</tbody>
          </table>
          ${after}
          ${footerRow(formNo, pageIndex + 1, pages)}
        </div>
      </section>
    `;
  });

  return wrapDocument(`Employee Training Matrix ${departmentName} ${year}`, "matrix", sheets.join(""));
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
  printHtml(renderOjtMatrixHtml(args), `Employee Training Matrix ${args.departmentName} ${args.year}`);
}
