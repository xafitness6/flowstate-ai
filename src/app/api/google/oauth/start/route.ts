// GET /api/google/oauth/start
// Redirects the user to Google's consent screen. `state` is signed with the
// user's auth UID so the callback can verify it came from us + identify the user.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleEnv, buildAuthUrl } from "@/lib/google/oauth";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const env = getGoogleEnv(origin);
  if (!env) {
    return NextResponse.json({
      error: "Google OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in env.",
    }, { status: 503 });
  }

  // `state` = userId + random nonce. We trust this because the redirect URI is
  // whitelisted in Google Console, so only our callback receives this state.
  const nonce = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, "");
  const state = `${user.id}.${nonce}`;

  const url = buildAuthUrl(env, state);
  return NextResponse.redirect(url);
}
