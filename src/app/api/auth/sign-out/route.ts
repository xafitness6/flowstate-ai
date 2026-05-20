import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Server-side sign-out. Runs supabase.auth.signOut() against the SSR client
// so the HttpOnly auth cookies (sb-*-auth-token) get cleared via Set-Cookie
// headers even if the browser client's call stalls. Called in parallel with
// the browser-side signOut from signOutEverywhere().
//
// Always returns 200 — never block logout on a Supabase error.

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("[sign-out] server signOut failed (continuing):", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
