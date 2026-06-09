// POST /api/me/macro-suggest  { calories? } → { calories, proteinG, carbsG, fatG, rationale }
// Calibrated from the signed-in athlete's OWN profile (Mifflin BMR → TDEE → goal
// → methodology macros). Not a generic guess. Returns 422 if the profile is too
// thin to compute (no weight/age/sex/height) so the UI can prompt them.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestMacros } from "@/lib/server/macroSuggest";
import type { IntakeData } from "@/lib/data/intake";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { calories?: number };

  const { data: row } = await supabase
    .from("onboarding_state").select("raw_answers").eq("user_id", user.id).maybeSingle();
  const intake = (row?.raw_answers && typeof row.raw_answers === "object")
    ? row.raw_answers as IntakeData : null;

  const result = suggestMacros(intake, body.calories);
  if (!result) {
    const onboarded = !!intake && Object.keys(intake).length > 0;
    return NextResponse.json(
      {
        error: onboarded
          ? "Add your bodyweight in your profile for a calibrated suggestion."
          : "Finish onboarding for a calibrated suggestion.",
        needsOnboarding: !onboarded, // only push to onboarding if they never did it
      },
      { status: 422 },
    );
  }
  return NextResponse.json(result);
}
