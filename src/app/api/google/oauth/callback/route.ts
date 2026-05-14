// GET /api/google/oauth/callback?code=...&state=...
// Google redirects here after consent. We:
//   1. Verify the state belongs to the current session user
//   2. Exchange code → tokens (access + refresh)
//   3. Upsert into google_calendar_tokens
//   4. Redirect back to /calendar/connect with status

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getGoogleEnv, exchangeCodeForTokens } from "@/lib/google/oauth";
import { ensureFlowstateCalendar } from "@/lib/google/calendar";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const url    = new URL(req.url);
  const code   = url.searchParams.get("code");
  const state  = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  const redirect = (params: Record<string, string>) => {
    const target = new URL("/calendar/connect", url.origin);
    for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
    return NextResponse.redirect(target);
  };

  if (errParam) return redirect({ google_error: errParam });
  if (!code || !state) return redirect({ google_error: "missing_code" });
  if (!user?.id)       return redirect({ google_error: "unauthorized" });

  // Verify state begins with this user's ID
  if (!state.startsWith(`${user.id}.`)) {
    return redirect({ google_error: "state_mismatch" });
  }

  const env = getGoogleEnv(url.origin);
  if (!env) return redirect({ google_error: "env_missing" });

  try {
    const tokens = await exchangeCodeForTokens(env, code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Provision a dedicated "Flowstate" calendar so events don't pollute the
    // user's primary calendar. Reuses an existing one if our app created it before.
    let calendarId: string | null = null;
    try {
      calendarId = await ensureFlowstateCalendar(tokens.access_token);
    } catch (e) {
      // Non-fatal — we'll fall back to primary calendar on push. But log so we know.
      console.error("[google/oauth] calendar provision failed:", e);
    }

    // Service role to bypass RLS — INSERT policies are intentionally absent
    const admin = await createAdminClient();
    const { error } = await admin
      .from("google_calendar_tokens")
      .upsert(
        {
          user_id:       user.id,
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,  // only on initial consent
          expires_at:    expiresAt,
          scope:         tokens.scope,
          token_type:    tokens.token_type,
          calendar_id:   calendarId,
          // Reset event_map on (re)connect — new calendar = no existing event mappings
          event_map:     {},
          last_sync_error: null,
          updated_at:    new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: false },
      );

    if (error) {
      console.error("[google/oauth] upsert:", error.message);
      return redirect({ google_error: "save_failed" });
    }

    return redirect({ google_connected: "1" });
  } catch (e) {
    console.error("[google/oauth] exchange failed:", e);
    return redirect({ google_error: "exchange_failed" });
  }
}
