// POST /api/me/ping — records that the signed-in user opened the app today.
// Upserts today's row in app_activity (distinct active days = "how often they
// log in") and stamps profiles.last_seen_at. Fire-and-forget; never errors loud.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const admin = await createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    await admin.from("app_activity").upsert({ user_id: user.id, day: today }, { onConflict: "user_id,day" });
    await admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
