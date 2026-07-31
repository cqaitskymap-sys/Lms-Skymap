/**
 * Optional transactional email for onboarding credentials.
 * Uses Resend when RESEND_API_KEY is configured; otherwise returns skipped.
 */

export interface CredentialsEmailPayload {
  to: string;
  hrName: string;
  employeeName: string;
  employeeCode: string;
  username: string;
  temporaryPassword: string;
  email: string;
  loginUrl: string;
  designation: string;
  departmentName?: string;
}

export async function sendOnboardingCredentialsEmail(
  payload: CredentialsEmailPayload
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    `${process.env.NEXT_PUBLIC_APP_NAME || "PharmaLMS"} <onboarding@${process.env.EMAIL_DOMAIN || "resend.dev"}>`;

  if (!apiKey) {
    return { sent: false, reason: "Email provider not configured (RESEND_API_KEY)" };
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "PharmaLMS";
  const subject = `${appName} — Login credentials for ${payload.employeeName}`;

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="margin-bottom:8px">${appName} — New employee credentials</h2>
      <p>Hello ${escapeHtml(payload.hrName)},</p>
      <p>An account was provisioned for <strong>${escapeHtml(payload.employeeName)}</strong>
      (${escapeHtml(payload.designation)}${payload.departmentName ? ` · ${escapeHtml(payload.departmentName)}` : ""}).</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px">
        <tr><td style="padding:10px 14px;color:#64748b">Employee code</td><td style="padding:10px 14px;font-weight:600">${escapeHtml(payload.employeeCode)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b">Username</td><td style="padding:10px 14px;font-family:monospace;font-weight:600">${escapeHtml(payload.username)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b">Email</td><td style="padding:10px 14px">${escapeHtml(payload.email)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b">Temporary password</td><td style="padding:10px 14px;font-family:monospace;font-weight:600">${escapeHtml(payload.temporaryPassword)}</td></tr>
      </table>
      <p><a href="${escapeHtml(payload.loginUrl)}" style="display:inline-block;background:#0e7490;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Open login</a></p>
      <p style="font-size:13px;color:#64748b">The employee must change this password, complete their profile, and accept company policies on first login. Do not forward credentials over unsecured channels.</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { sent: false, reason: `Email API error: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
