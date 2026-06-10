// GET /api/clients/[id]/nutrition — a compact nutrition summary for the trainer.
// Last 14 days of the client's meals, bucketed by day, plus 7-day averages and
// the most recent meals. Admin: any client. Trainer: only their assigned clients.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { calculateEnergy, calculateNutritionTargets } from "@/lib/nutrition";
import type { IntakeData } from "@/lib/data/intake";

type Row = {
  id: string;
  meal_type: string | null;
  raw_text: string | null;
  clean_transcript: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  needs_review: boolean | null;
  logged_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const num = (v: number | null) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const since = new Date(Date.now() - 14 * DAY_MS).toISOString();
  const { data: profile } = await auth.admin
    .from("profiles")
    .select("meal_logs_visible")
    .eq("id", id)
    .maybeSingle();
  const canViewMealLabels = auth.isAdmin || (profile as { meal_logs_visible?: boolean } | null)?.meal_logs_visible === true;

  const mealSelect = canViewMealLabels
    ? "id,meal_type,raw_text,clean_transcript,calories,protein,carbs,fat,needs_review,logged_at"
    : "id,meal_type,calories,protein,carbs,fat,needs_review,logged_at";
  const { data, error } = await auth.admin
    .from("nutrition_logs")
    .select(mealSelect)
    .eq("user_id", id)
    .is("deleted_at", null)
    .gte("logged_at", since)
    .order("logged_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as unknown) as Row[];

  // Bucket the last 14 days (oldest → newest) so the UI can draw a mini chart.
  const days: { date: string; calories: number; protein: number; carbs: number; fat: number; meals: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    days.push({ date, calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));

  for (const r of rows) {
    const bucket = byDate.get(dayKey(r.logged_at));
    if (!bucket) continue;
    bucket.calories += num(r.calories);
    bucket.protein  += num(r.protein);
    bucket.carbs    += num(r.carbs);
    bucket.fat      += num(r.fat);
    bucket.meals    += 1;
  }

  // 7-day averages over days that actually have meals logged.
  const last7 = days.slice(-7);
  const logged7 = last7.filter((d) => d.meals > 0);
  const n = logged7.length || 1;
  const avg = {
    calories: Math.round(logged7.reduce((s, d) => s + d.calories, 0) / n),
    protein:  Math.round(logged7.reduce((s, d) => s + d.protein,  0) / n),
    carbs:    Math.round(logged7.reduce((s, d) => s + d.carbs,    0) / n),
    fat:      Math.round(logged7.reduce((s, d) => s + d.fat,      0) / n),
  };

  const today = byDate.get(new Date().toISOString().slice(0, 10)) ?? null;

  // Energy profile (BMR / TDEE / target) + targets from the client's intake.
  let energy = null;
  let targets = null;
  const { data: onb } = await auth.admin
    .from("onboarding_state")
    .select("raw_answers")
    .eq("user_id", id)
    .single();
  const intake = onb?.raw_answers as IntakeData | null | undefined;
  if (intake && typeof intake === "object" && typeof intake.weight === "string") {
    energy  = calculateEnergy(intake);
    targets = calculateNutritionTargets(intake);
  }

  const recentMeals = rows.slice(0, 8).map((r) => ({
    id: r.id,
    meal_type: r.meal_type,
    label: canViewMealLabels ? (r.clean_transcript || r.raw_text || "").slice(0, 120) : "",
    calories: num(r.calories),
    protein: num(r.protein),
    needs_review: r.needs_review === true,
    logged_at: r.logged_at,
  }));

  return NextResponse.json({
    days,
    today,
    avg,
    daysLogged7: logged7.length,
    totalMeals14: rows.length,
    recentMeals,
    energy,
    targets,
  });
}
