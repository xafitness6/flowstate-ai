import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getEmailDiagnostics, sendEmailDiagnostic } from "@/lib/server/email";

type Body = {
  to?: unknown;
};

type AdminClient = SupabaseClient<any>;

function adminEmail(user: { email?: string | null }): string {
  return typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
}

async function passwordResetPreflight(admin: AdminClient, email?: string) {
  const tokenProbe = await admin
    .from("auth_password_tokens")
    .select("id", { count: "exact", head: true })
    .limit(1);

  let profile:
    | { checked: false }
    | { checked: true; found: boolean; archived: boolean | null; error: string | null } = { checked: false };

  if (email?.includes("@")) {
    const profileProbe = await admin
      .from("profiles")
      .select("id,archived_at")
      .ilike("email", email.trim().toLowerCase())
      .maybeSingle();

    profile = {
      checked: true,
      found: Boolean(profileProbe.data),
      archived: profileProbe.data && typeof profileProbe.data === "object"
        ? Boolean((profileProbe.data as { archived_at?: string | null }).archived_at)
        : null,
      error: profileProbe.error?.message ?? null,
    };
  }

  return {
    authPasswordTokensTable: {
      ok: !tokenProbe.error,
      error: tokenProbe.error?.message ?? null,
    },
    profile,
  };
}

function diagnosticNotes(diagnostics: ReturnType<typeof getEmailDiagnostics>, preflight?: Awaited<ReturnType<typeof passwordResetPreflight>>) {
  return [
    ...(!diagnostics.hasResendApiKey ? ["RESEND_API_KEY is missing."] : []),
    ...(!diagnostics.hasFromEmail ? ["PASSWORD_RESET_FROM_EMAIL is missing; Resend sandbox sender is being used."] : []),
    ...(diagnostics.usingResendSandboxSender ? ["Resend sandbox sender can be restricted. Use a verified domain sender for production."] : []),
    ...(!diagnostics.appUrl ? ["NEXT_PUBLIC_APP_URL or APP_URL is missing."] : []),
    ...(!diagnostics.hasResetCodeSecret ? ["PASSWORD_RESET_CODE_SECRET is missing; add a stable server-only secret before production."] : []),
    ...(diagnostics.productionDebugResetCodes ? ["ENABLE_DEV_ROUTE is true in production; disable it after testing so dev-only auth surfaces stay closed."] : []),
    ...(preflight && !preflight.authPasswordTokensTable.ok ? ["auth_password_tokens table is missing or unavailable; apply migration 018_app_owned_password_reset_tokens.sql."] : []),
    ...(preflight?.profile.checked && !preflight.profile.found ? ["No profiles row was found for this email; password reset intentionally does not send."] : []),
    ...(preflight?.profile.checked && preflight.profile.archived ? ["This profile is archived; password reset intentionally does not send."] : []),
  ];
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const diagnostics = getEmailDiagnostics();
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  const preflight = await passwordResetPreflight(auth.admin, email || adminEmail(auth.user));
  return NextResponse.json({
    ok: true,
    diagnostics,
    passwordResetPreflight: preflight,
    canSendEmail: diagnostics.hasResendApiKey,
    notes: diagnosticNotes(diagnostics, preflight),
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

  const preflight = await passwordResetPreflight(auth.admin, to);
  const result = await sendEmailDiagnostic({ to });
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        error: result.error,
        diagnostics: getEmailDiagnostics(),
        passwordResetPreflight: preflight,
      },
      { status: 502 },
    );
  }
  if (!result.sent) {
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        reason: result.reason,
        diagnostics: getEmailDiagnostics(),
        passwordResetPreflight: preflight,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    id: result.id ?? null,
    to,
    diagnostics: getEmailDiagnostics(),
    passwordResetPreflight: preflight,
  });
}
