// ─── Nutrition Analytics ─────────────────────────────────────────────────────
//
// Pure computation — no side effects, no localStorage writes.
// Takes data from store + hydration functions and returns analytics summaries.

import { getMealsForRange } from "./store";
import { getTotalHydrationForDate } from "./hydration";
import type { NutritionTargets } from "@/lib/nutrition";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayData {
  date:        string;   // YYYY-MM-DD
  calories:    number;
  protein:     number;
  carbs:       number;
  fat:         number;
  hydrationMl: number;
  mealCount:   number;
  logged:      boolean;  // true if any meals were logged that day
}

export interface AnalyticsSummary {
  days:          DayData[];
  totalDays:     number;   // length of requested range
  daysLogged:    number;   // days with ≥1 meal
  streak:        number;   // consecutive logged days ending today
  avgCalories:   number;
  avgProtein:    number;
  avgCarbs:      number;
  avgFat:        number;
  avgHydration:  number;
  calGoalPct:    number;   // avgCalories / target.calories  (0–1+)
  protGoalPct:   number;
  carbGoalPct:   number;
  fatGoalPct:    number;
  hydGoalPct:    number;
  insight:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateRange(startISO: string, endISO: string): string[] {
  const dates: string[] = [];
  const cur = new Date(startISO + "T12:00:00");
  const end = new Date(endISO   + "T12:00:00");
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function computeStreak(days: DayData[]): number {
  // Count consecutive logged days from the most recent (last) going back
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].logged) streak++;
    else break;
  }
  return streak;
}

function generateInsight(s: AnalyticsSummary, targets: NutritionTargets): string {
  const { days, daysLogged, totalDays, streak, avgCalories } = s;
  const calPct  = targets.calories > 0 ? avgCalories / targets.calories : 1;
  const protPct = targets.proteinG > 0 ? s.avgProtein / targets.proteinG : 1;
  const hydPct  = targets.waterMl  > 0 ? s.avgHydration / targets.waterMl  : 1;

  const underEatDays = days.filter((d) => d.logged && d.calories < targets.calories * 0.75).length;
  const overEatDays  = days.filter((d) => d.logged && d.calories > targets.calories * 1.1).length;

  const parts: string[] = [];

  if (daysLogged === 0)  return "No meals logged in this period.";
  if (daysLogged < totalDays * 0.5) {
    parts.push(`Only ${daysLogged} of ${totalDays} days logged — consistency is the key.`);
  } else if (streak >= 5) {
    parts.push(`${streak}-day logging streak. Outstanding.`);
  } else if (streak >= 3) {
    parts.push(`${streak}-day streak — keep it going.`);
  }

  if (underEatDays >= Math.ceil(daysLogged * 0.4)) {
    parts.push(`Under-target calories on ${underEatDays} of ${daysLogged} logged days.`);
  } else if (overEatDays >= Math.ceil(daysLogged * 0.4)) {
    parts.push(`Over target calories on ${overEatDays} days this period.`);
  } else if (calPct >= 0.88 && calPct <= 1.08) {
    parts.push("Calorie intake is well on target.");
  }

  if (protPct >= 0.9) {
    parts.push("Protein consistency is strong.");
  } else if (protPct < 0.65) {
    parts.push("Protein intake has been consistently low — prioritise protein sources.");
  }

  if (hydPct < 0.5 && daysLogged > 2) {
    parts.push("Hydration is tracking below 50% of goal.");
  }

  return parts.slice(0, 2).join(" ") || "Looking solid — keep logging to see trends.";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeNutritionAnalytics(
  userId:    string,
  startDate: string,
  endDate:   string,
  targets:   NutritionTargets,
): AnalyticsSummary {
  const dates = dateRange(startDate, endDate);
  const meals = getMealsForRange(userId, startDate, endDate);

  const days: DayData[] = dates.map((date) => {
    const dayMeals = meals.filter((m) => m.eatenAt.slice(0, 10) === date);
    const calories = dayMeals.reduce((s, m) => s + m.totals.calories, 0);
    const protein  = dayMeals.reduce((s, m) => s + m.totals.protein,  0);
    const carbs    = dayMeals.reduce((s, m) => s + m.totals.carbs,    0);
    const fat      = dayMeals.reduce((s, m) => s + m.totals.fat,      0);
    const hydrationMl = getTotalHydrationForDate(userId, date);
    return {
      date,
      calories, protein, carbs, fat,
      hydrationMl,
      mealCount: dayMeals.length,
      logged:    dayMeals.length > 0,
    };
  });

  const logged     = days.filter((d) => d.logged);
  const n          = logged.length || 1; // avoid div/0

  const avgCalories   = logged.reduce((s, d) => s + d.calories,    0) / n;
  const avgProtein    = logged.reduce((s, d) => s + d.protein,     0) / n;
  const avgCarbs      = logged.reduce((s, d) => s + d.carbs,       0) / n;
  const avgFat        = logged.reduce((s, d) => s + d.fat,         0) / n;
  const avgHydration  = days.reduce((s, d) => s + d.hydrationMl,   0) / days.length;

  const summary: AnalyticsSummary = {
    days,
    totalDays:    dates.length,
    daysLogged:   logged.length,
    streak:       computeStreak(days),
    avgCalories,
    avgProtein,
    avgCarbs,
    avgFat,
    avgHydration,
    calGoalPct:   targets.calories > 0 ? avgCalories   / targets.calories : 0,
    protGoalPct:  targets.proteinG > 0 ? avgProtein    / targets.proteinG : 0,
    carbGoalPct:  targets.carbsG   > 0 ? avgCarbs      / targets.carbsG   : 0,
    fatGoalPct:   targets.fatG     > 0 ? avgFat        / targets.fatG     : 0,
    hydGoalPct:   targets.waterMl  > 0 ? avgHydration  / targets.waterMl  : 0,
    insight:      "",
  };
  summary.insight = generateInsight(summary, targets);
  return summary;
}
