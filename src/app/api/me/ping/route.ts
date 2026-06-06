// POST /api/me/ping — records that the signed-in user opened the app today.
// Upserts today's row in app_activity (distinct active days = "how often they
// log in") and stamps profiles.last_seen_at. Fire-and-forget; never errors loud.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let tz: string | null = null;
  try { const b = await req.json(); if (typeof b?.tz === "string" && b.tz.includes("/")) tz = b.tz; } catch { /* no body */ }

  try {
    const admin = await createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    await admin.from("app_activity").upsert({ user_id: user.id, day: today }, { onConflict: "user_id,day" });
    await admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    // Auto-detect timezone on first open; never clobber a manual choice.
    if (tz) {
      const { data: prof } = await admin.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
      if (!prof?.timezone) await admin.from("profiles").update({ timezone: tz }).eq("id", user.id);
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
