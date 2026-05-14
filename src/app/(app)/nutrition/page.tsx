// Server Component — fetches today's meals, hydration, and macro targets
// (derived from intake) so the page paints with data already in place.
// Subsequent date changes use the client-side path in NutritionClient.

import { createClient } from "@/lib/supabase/server";
import { rowToMeal } from "@/lib/nutrition/store";
import { calculateNutritionTargets, type NutritionTargets } from "@/lib/nutrition";
import type { LoggedMeal } from "@/lib/nutrition/types";
import type { IntakeData } from "@/lib/data/intake";
import NutritionClient, { type NutritionSSRData } from "./NutritionClient";

export const dynamic = "force-dynamic";

function todayLocalBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { gte: start.toISOString(), lte: end.toISOString() };
}

export default async function NutritionPage() {
  const supabase = await createClient();

  let initial: NutritionSSRData = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return <NutritionClient initial={null} />;

    const { gte, lte } = todayLocalBounds();

    const [mealsRes, hydRes, intakeRes] = await Promise.all([
      supabase
        .from("nutrition_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("logged_at", gte)
        .lte("logged_at", lte)
        .is("deleted_at", null)
        .order("logged_at", { ascending: true }),
      supabase
        .from("hydration_logs")
        .select("amount_ml")
        .eq("user_id", user.id)
        .gte("logged_at", gte)
        .lte("logged_at", lte),
      supabase
        .from("onboarding_state")
        .select("raw_answers")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const meals: LoggedMeal[] = (mealsRes.data ?? []).map((row) =>
      rowToMeal(row as Record<string, unknown>),
    );

    const hydration: number = ((hydRes.data ?? []) as Array<{ amount_ml: number }>)
      .reduce((sum, h) => sum + (Number(h.amount_ml) || 0), 0);

    let targets: NutritionTargets | null = null;
    const intakeRow = intakeRes.data as { raw_answers?: Record<string, unknown> | null } | null;
    if (intakeRow?.raw_answers && typeof intakeRow.raw_answers === "object") {
      const answers = intakeRow.raw_answers as Record<string, unknown>;
      if (typeof answers.weight === "string") {
        targets = calculateNutritionTargets(answers as unknown as IntakeData);
      }
    }

    initial = { meals, hydration, targets };
  } catch (e) {
    console.warn("[nutrition SSR] fetch failed:", e);
    initial = null;
  }

  return <NutritionClient initial={initial} />;
}
