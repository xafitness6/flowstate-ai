import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }
    return NextResponse.redirect(`${origin}${safeNext ?? "/"}`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
