// GET  /api/me/timezone — the signed-in user's saved timezone (IANA).
// POST /api/me/timezone  { timezone } — override it. Scheduled times are stored
// as absolute instants and shown in each viewer's zone; this is the explicit
// setting (auto-detected on first open via the activity ping).

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

function isValidTz(tz: string): boolean {
  try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return tz.includes("/"); } catch { return false; }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ timezone: null }, { status: 401 });
  const { data } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
  return NextResponse.json({ timezone: (data?.timezone as string | null) ?? null });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { timezone?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const tz = typeof body.timezone === "string" ? body.timezone.trim() : "";
  if (!isValidTz(tz)) return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });

  const admin = await createAdminClient();
  const { error } = await admin.from("profiles").update({ timezone: tz }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, timezone: tz });
}
