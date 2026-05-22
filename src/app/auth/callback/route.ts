import { NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TOKEN_TYPES = new Set(["signup", "recovery", "invite", "email_change", "email"]);

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");
  const nextParam = searchParams.get("next");
  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type") ?? "email";

  // Only allow same-origin relative redirects; ignore anything else.
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : null;

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth&reason=provider`);
  }

  if (tokenHash) {
    if (!ALLOWED_TOKEN_TYPES.has(tokenType)) {
      return NextResponse.redirect(`${origin}/login?error=auth&reason=confirm_link`);
    }
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType as EmailOtpType,
    });
    if (verifyError) {
      return NextResponse.redirect(`${origin}/login?notice=confirmation_used`);
    }
    return NextResponse.redirect(`${origin}${safeNext ?? "/auth/finish"}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(`${origin}/login?error=auth&reason=exchange`);
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=auth&reason=no_session`);
    }

    if (safeNext) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }

    return NextResponse.redirect(`${origin}/auth/finish`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
