import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set(["signup", "magiclink", "recovery", "invite", "email_change", "email"]);

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/auth/finish";
  return value;
}

export async function GET(req: NextRequest) {
  const { origin, searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "email";
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth&reason=exchange`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (!tokenHash || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(`${origin}/login?error=auth&reason=confirm_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    return NextResponse.redirect(`${origin}/login?notice=confirmation_used`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
