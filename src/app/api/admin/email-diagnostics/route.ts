import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getEmailDiagnostics, sendEmailDiagnostic } from "@/lib/server/email";

type Body = {
  to?: unknown;
};

function adminEmail(user: { email?: string | null }): string {
  return typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const diagnostics = getEmailDiagnostics();
  return NextResponse.json({
    ok: true,
    diagnostics,
    canSendEmail: diagnostics.hasResendApiKey,
    notes: [
      ...(!diagnostics.hasResendApiKey ? ["RESEND_API_KEY is missing."] : []),
      ...(!diagnostics.hasFromEmail ? ["PASSWORD_RESET_FROM_EMAIL is missing; Resend sandbox sender is being used."] : []),
      ...(diagnostics.usingResendSandboxSender ? ["Resend sandbox sender can be restricted. Use a verified domain sender for production."] : []),
      ...(!diagnostics.appUrl ? ["NEXT_PUBLIC_APP_URL or APP_URL is missing."] : []),
      ...(!diagnostics.hasResetCodeSecret ? ["PASSWORD_RESET_CODE_SECRET is missing; add a stable server-only secret before production."] : []),
    ],
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* default to admin email */ }

  const to =
    typeof body.to === "string" && body.to.includes("@")
      ? body.to.trim().toLowerCase()
      : adminEmail(auth.user);

  if (!to) {
    return NextResponse.json({ error: "No destination email available." }, { status: 400 });
  }

  const result = await sendEmailDiagnostic({ to });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, sent: false, error: result.error, diagnostics: getEmailDiagnostics() },
      { status: 502 },
    );
  }
  if (!result.sent) {
    return NextResponse.json(
      { ok: false, sent: false, reason: result.reason, diagnostics: getEmailDiagnostics() },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, sent: true, id: result.id ?? null, to });
}
