import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "xavellis4@gmail.com";
const EMAIL_COOKIE = "flowstate-session-email";
const ID_COOKIE = "flowstate-session-id";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");
  const nextParam = searchParams.get("next");

  // Only allow same-origin relative redirects; ignore anything else.
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : null;

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth&reason=provider`);
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

    const email = user.email?.trim().toLowerCase();
    const response = NextResponse.redirect(`${origin}${email === ADMIN_EMAIL ? "/admin" : "/onboarding"}`);
    if (email === ADMIN_EMAIL) {
      const cookieOptions = {
        path: "/",
        sameSite: "lax" as const,
        secure: origin.startsWith("https://"),
        maxAge: 60 * 60 * 24 * 30,
      };
      response.cookies.set(EMAIL_COOKIE, email, cookieOptions);
      response.cookies.set(ID_COOKIE, user.id, cookieOptions);
    }
    return response;
  }

  return NextResponse.redirect(`${origin}/login`);
}
