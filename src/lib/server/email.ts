type SendEmailResult =
  | { ok: true; sent: true; id?: string }
  | { ok: true; sent: false; reason: "not_configured" }
  | { ok: false; sent: false; error: string };

type SendViaResendArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;   // optional branded HTML; falls back to textToHtml(text)
};

function textToHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line.replace(/[&<>"]/g, (char) => {
      switch (char) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        default: return char;
      }
    })}</p>`)
    .join("");
}

function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PASSWORD_RESET_FROM_EMAIL?.trim() || "Flowstate AI <onboarding@resend.dev>";
  return { apiKey, from };
}

export function getEmailDiagnostics() {
  const { apiKey, from } = emailConfig();
  const productionDebugResetCodes =
    process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTE === "true";
  return {
    hasResendApiKey: Boolean(apiKey),
    hasFromEmail: Boolean(process.env.PASSWORD_RESET_FROM_EMAIL?.trim()),
    from,
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || null,
    hasResetCodeSecret: Boolean(process.env.PASSWORD_RESET_CODE_SECRET?.trim()),
    usingResendSandboxSender: from.includes("onboarding@resend.dev"),
    productionDebugResetCodes,
  };
}

async function sendViaResend(args: SendViaResendArgs): Promise<SendEmailResult> {
  const { apiKey, from } = emailConfig();
  if (!apiKey) return { ok: true, sent: false, reason: "not_configured" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html ?? textToHtml(args.text),
    }),
  });

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    return {
      ok: false,
      sent: false,
      error: body || `Resend request failed with status ${response.status}`,
    };
  }

  let id: string | undefined;
  try {
    const parsed = body ? JSON.parse(body) as { id?: unknown } : {};
    id = typeof parsed.id === "string" ? parsed.id : undefined;
  } catch { /* ignore */ }

  return { ok: true, sent: true, id };
}

export async function sendPasswordResetEmail(args: {
  to: string;
  code: string;
  resetUrl: string;
}): Promise<SendEmailResult> {
  const text = [
    "Use this Flowstate AI code to reset your password:",
    args.code,
    "Then open the password reset page:",
    args.resetUrl,
    "This code expires in 10 minutes and is only used when you submit your new password.",
    "If you did not request this, you can ignore this email.",
  ].join("\n\n");

  return sendViaResend({
    to: args.to,
    subject: "Reset your Flowstate AI password",
    text,
    html: passwordResetHtml(args.code, args.resetUrl),
  });
}

// ─── Branded HTML template ────────────────────────────────────────────────────
// Edit this to change how the reset email looks. Uses inline styles + a dark
// card with the gold Flowstate accent (#B48B40). Email clients ignore <style>
// blocks and external CSS, so everything is inline.
function passwordResetHtml(code: string, resetUrl: string): string {
  const safeCode = code.replace(/[^0-9A-Za-z]/g, "");
  const safeUrl = resetUrl.replace(/"/g, "");
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#000000;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#161616;border:1px solid rgba(255,255,255,0.07);border-radius:24px;">
          <tr><td style="padding:40px 44px 0;">
            <p style="margin:0;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.6);">
              <span style="color:#F5C24B;">&#9889;</span>&nbsp;&nbsp;Flowstate AI
            </p>
            <h1 style="margin:24px 0 0;font-size:34px;line-height:1.1;color:#ffffff;font-weight:700;">Reset your password</h1>
          </td></tr>
          <tr><td style="padding:20px 44px 0;">
            <p style="margin:0;font-size:16px;line-height:1.6;color:rgba(255,255,255,0.55);">Use this secure code to create a new password for your Flowstate account.</p>
          </td></tr>
          <tr><td style="padding:24px 44px 0;">
            <div style="background:rgba(184,145,80,0.10);border:1px solid rgba(184,145,80,0.30);border-radius:14px;padding:20px;text-align:center;">
              <span style="font-size:34px;letter-spacing:10px;font-weight:700;color:#E5C07B;font-family:'SF Mono',Menlo,Consolas,monospace;">${safeCode}</span>
            </div>
          </td></tr>
          <tr><td style="padding:24px 44px 0;">
            <a href="${safeUrl}" style="display:inline-block;background:#B8924F;color:#000000;text-decoration:none;font-weight:700;font-size:16px;padding:16px 32px;border-radius:14px;">Reset password</a>
          </td></tr>
          <tr><td style="padding:28px 44px 40px;">
            <p style="margin:0;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.4);">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendEmailDiagnostic(args: {
  to: string;
}): Promise<SendEmailResult> {
  const text = [
    "Flowstate AI email diagnostics test.",
    "If you received this message, the deployed app can send email through Resend.",
    `Sent at: ${new Date().toISOString()}`,
  ].join("\n\n");

  return sendViaResend({
    to: args.to,
    subject: "Flowstate AI email test",
    text,
  });
}
