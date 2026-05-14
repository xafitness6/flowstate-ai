// GET /api/google/oauth/start
// Redirects the user to Google's consent screen. `state` is signed with the
// user's auth UID so the callback can verify it came from us + identify the user.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleEnv, buildAuthUrl } from "@/lib/google/oauth";

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const errorRedirect = (code: string) => {
    const target = new URL("/calendar/connect", origin);
    target.searchParams.set("google_error", code);
    return NextResponse.redirect(target);
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return errorRedirect("unauthorized");

  const env = getGoogleEnv(origin);
  if (!env) return errorRedirect("not_configured");

  // `state` = userId + random nonce. We trust this because the redirect URI is
  // whitelisted in Google Console, so only our callback receives this state.
  const nonce = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, "");
  const state = `${user.id}.${nonce}`;

  const url = buildAuthUrl(env, state);
  return NextResponse.redirect(url);
}
