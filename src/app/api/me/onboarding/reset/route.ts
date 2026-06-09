// POST /api/me/onboarding/reset — the signed-in user wipes their OWN onboarding
// to start fresh (clears answers + flags, archives their active program, clears
// their computed targets). Strictly scoped to user.id — touches no other account.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = await createAdminClient();
  const uid = user.id; // every write below is filtered by this — never cross-account

  await admin.from("onboarding_state").upsert({
    user_id: uid,
    raw_answers: null,
    onboarding_complete: false,
    walkthrough_seen: false,
    body_focus_complete: false,
    planning_conversation_complete: false,
    program_generated: false,
    profile_complete: false,
    tutorial_complete: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  // Best-effort: archive their active program + clear computed targets.
  try { await admin.from("programs").update({ status: "archived" }).eq("user_id", uid).eq("status", "active"); } catch { /* non-fatal */ }
  try { await admin.from("nutrition_targets").delete().eq("user_id", uid); } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
