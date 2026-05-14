// GET    /api/google/status     — { connected, last_synced_at, last_sync_error }
// DELETE /api/google/status     — disconnect (revoke token + delete row)

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revokeToken } from "@/lib/google/oauth";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("last_synced_at, last_sync_error, scope")
    .eq("user_id", user.id)
    .maybeSingle();

  type Row = { last_synced_at: string | null; last_sync_error: string | null; scope: string | null };
  const row = (data as Row | null) ?? null;

  return NextResponse.json({
    connected:       !!row,
    last_synced_at:  row?.last_synced_at ?? null,
    last_sync_error: row?.last_sync_error ?? null,
    scope:           row?.scope ?? null,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await createAdminClient();

  // Fetch token so we can revoke it client-side at Google
  const { data: tokenRow } = await admin
    .from("google_calendar_tokens")
    .select("refresh_token, access_token")
    .eq("user_id", user.id)
    .maybeSingle();
  type TokenRow = { refresh_token: string | null; access_token: string | null };
  const tokens = (tokenRow as TokenRow | null) ?? null;

  if (tokens?.refresh_token) await revokeToken(tokens.refresh_token);
  else if (tokens?.access_token) await revokeToken(tokens.access_token);

  const { error } = await admin
    .from("google_calendar_tokens")
    .delete()
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
