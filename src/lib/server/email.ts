type SendEmailResult =
  | { ok: true; sent: true; id?: string }
  | { ok: true; sent: false; reason: "not_configured" }
  | { ok: false; sent: false; error: string };

type SendViaResendArgs = {
  to: string;
  subject: string;
  text: string;
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
      html: textToHtml(args.text),
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
  });
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
