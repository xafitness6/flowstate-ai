// GET /api/me/missing-intake — the onboarding questions the signed-in user
// still hasn't answered (newly-added fields they onboarded before we had).
// Powers the "finish your profile" prompt and the nudge notification.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { missingQuestions } from "@/lib/intake/backfill";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ questions: [] }, { status: 401 });

  const { data: row } = await supabase
    .from("onboarding_state").select("raw_answers").eq("user_id", user.id).maybeSingle();

  const raw = (row?.raw_answers && typeof row.raw_answers === "object")
    ? row.raw_answers as Record<string, unknown> : null;

  return NextResponse.json({ questions: missingQuestions(raw) });
}
