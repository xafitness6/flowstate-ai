type SendEmailResult =
  | { ok: true; sent: true }
  | { ok: true; sent: false; reason: "not_configured" }
  | { ok: false; sent: false; error: string };

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

export async function sendPasswordResetEmail(args: {
  to: string;
  code: string;
  resetUrl: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PASSWORD_RESET_FROM_EMAIL?.trim() || "Flowstate AI <onboarding@resend.dev>";
  if (!apiKey) return { ok: true, sent: false, reason: "not_configured" };

  const subject = "Reset your Flowstate AI password";
  const text = [
    "Use this Flowstate AI code to reset your password:",
    args.code,
    "Then open the password reset page:",
    args.resetUrl,
    "This code expires in 10 minutes and is only used when you submit your new password.",
    "If you did not request this, you can ignore this email.",
  ].join("\n\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject,
      text,
      html: textToHtml(text),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      sent: false,
      error: body || `Resend request failed with status ${response.status}`,
    };
  }

  return { ok: true, sent: true };
}
