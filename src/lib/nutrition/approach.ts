// ─── Nutrition philosophy + meal pattern + optional carb cycling ─────────────
// Core philosophy: balanced, healthy eating tuned to your real numbers.
// The coach watches weekly progress and adjusts calories or training when you
// stall. The food side stays simple.
//
// On top of that base, the user shapes WHEN they eat (meal pattern) and
// optionally HOW they distribute carbs (carb cycling).
//
// All defaults / day-pattern carb math come from Xavier's "How to Conquer Your
// Carbs" ebook (XAthletics).

export type GoalMode = "cut" | "maintain" | "build";

export type MealPattern =
  | "three_plus_snacks"   // breakfast + lunch + dinner + 1–2 snacks (default)
  | "three"               // 3 meals, no snacks
  | "two"                 // brunch + dinner
  | "if"                  // 16:8 intermittent fast, 3 meals inside the window
  | "omad";               // one meal a day

export type TrainingTiming = "fasted_am" | "after_1_meal" | "after_2_meals" | "after_3_meals";

export const GOAL_MODE_META: Record<GoalMode, { label: string; sub: string }> = {
  cut:      { label: "Cut",      sub: "Shred body fat"      },
  maintain: { label: "Maintain", sub: "Hold current weight" },
  build:    { label: "Build",    sub: "Add lean muscle"     },
};

/** Calorie delta from maintenance (TDEE) for the chosen goal mode. */
export function goalCalorieAdjustment(goalMode: GoalMode): number {
  switch (goalMode) {
    case "cut":      return -500;
    case "build":    return  300;
    case "maintain": return    0;
  }
}

/** Final daily calorie target for the chosen goal, with a 1200 floor. */
export function goalAdjustedCalories(tdee: number, goalMode: GoalMode): number {
  return Math.max(1200, tdee + goalCalorieAdjustment(goalMode));
}

/** Macro split that matches the goal — keeps protein anchored to bodyweight. */
export function goalAdjustedMacros(
  tdee: number,
  goalMode: GoalMode,
  bodyWeightKg: number,
): { calories: number; proteinG: number; carbsG: number; fatG: number } {
  const calories  = goalAdjustedCalories(tdee, goalMode);
  // Protein grams per kg: higher when cutting (preserve muscle in deficit).
  const perKg     = goalMode === "cut" ? 2.2 : goalMode === "build" ? 2.0 : 1.8;
  const fallback  = goalMode === "cut" ? 165 : goalMode === "build" ? 150 : 135;
  const proteinG  = bodyWeightKg > 0 ? Math.round(bodyWeightKg * perKg) : fallback;
  const fatG      = Math.round((calories * 0.28) / 9);
  const carbsG    = Math.max(50, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return { calories, proteinG, carbsG, fatG };
}

export const MEAL_PATTERN_META: Record<MealPattern, {
  label:       string;
  tagline:     string;
  body:        string;
  icon:        string;
  isFast:      boolean;
}> = {
  three_plus_snacks: {
    label:   "3 meals + snacks",
    tagline: "The default — easiest to hit targets",
    body:    "Breakfast, lunch, dinner with 1–2 protein-anchored snacks. Most flexible pattern for steady energy and recovery.",
    icon:    "🍽️",
    isFast:  false,
  },
  three: {
    label:   "3 meals, no snacks",
    tagline: "Clean three squares",
    body:    "Three meals, evenly spaced (~5hrs apart). Bigger plates per sitting, no grazing between.",
    icon:    "🥗",
    isFast:  false,
  },
  two: {
    label:   "2 meals",
    tagline: "Late breakfast + dinner",
    body:    "Two large meals — a brunch around noon and dinner ~6 hrs later. Half-step into compressed eating.",
    icon:    "🍳",
    isFast:  true,
  },
  if: {
    label:   "Intermittent fast (16:8)",
    tagline: "Eat in an 8-hour window",
    body:    "1–3 meals inside an 8hr window, water/tea outside. Hormone regulation and a simpler entry to fasting.",
    icon:    "⏱️",
    isFast:  true,
  },
  omad: {
    label:   "One meal a day",
    tagline: "Aggressive fast — advanced",
    body:    "One large meal in a ~2hr window. Maximum autophagy benefit. Only after you've adapted to 16:8.",
    icon:    "🌙",
    isFast:  true,
  },
};

export const TRAINING_TIMING_META: Record<TrainingTiming, { label: string; sub: string }> = {
  fasted_am:     { label: "Fasted AM",     sub: "Train before eating"  },
  after_1_meal:  { label: "After 1 meal",  sub: "Train after breakfast" },
  after_2_meals: { label: "After 2 meals", sub: "Train mid-afternoon"   },
  after_3_meals: { label: "After 3 meals", sub: "Train in the evening" },
};

// ─── localStorage shape ─────────────────────────────────────────────────────

export type ApproachState = {
  goalMode:        GoalMode;
  mealPattern:     MealPattern;
  trainingTiming:  TrainingTiming;
  carbCyclingOn:   boolean;
  firstMealHour24: number; // when does the eating window start (24h)
};

const KEY = (userId: string) => `flowstate-nutrition-approach-${userId}`;

const DEFAULT_STATE: ApproachState = {
  goalMode:        "maintain",
  mealPattern:     "three_plus_snacks",
  trainingTiming:  "after_1_meal",
  carbCyclingOn:   false,
  firstMealHour24: 8,
};

export function loadApproach(userId: string): ApproachState {
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<ApproachState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveApproach(userId: string, state: ApproachState): void {
  try { localStorage.setItem(KEY(userId), JSON.stringify(state)); } catch { /* quota */ }
  // Best-effort write-through to Supabase so the trainer sees the same picker.
  // Silent failure (migration not applied, demo user, etc.) — local cache wins.
  syncApproachToSupabase(userId, state).catch(() => { /* ignore */ });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function canUseSupabase(userId: string): boolean {
  return UUID_RE.test(userId)
    && typeof process !== "undefined"
    && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

async function syncApproachToSupabase(userId: string, state: ApproachState): Promise<void> {
  if (!canUseSupabase(userId) || typeof fetch === "undefined") return;
  try {
    await fetch(`/api/clients/${userId}/nutrition-approach`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch { /* ignore */ }
}

/**
 * Hydrate the approach from Supabase on first load — falls back to localStorage
 * (or DEFAULT_STATE) when the column is missing or the user is a demo account.
 * Always returns a usable ApproachState.
 */
export async function fetchApproach(userId: string): Promise<ApproachState> {
  const local = loadApproach(userId);
  if (!canUseSupabase(userId) || typeof fetch === "undefined") return local;
  try {
    const res = await fetch(`/api/clients/${userId}/nutrition-approach`, { cache: "no-store" });
    if (!res.ok) return local;
    const json = await res.json() as { approach?: Partial<ApproachState> | null };
    if (!json.approach) return local;
    const merged = { ...DEFAULT_STATE, ...local, ...json.approach };
    try { localStorage.setItem(KEY(userId), JSON.stringify(merged)); } catch { /* quota */ }
    return merged;
  } catch {
    return local;
  }
}

/** Has the user ever saved their own approach choices yet? */
export function hasStoredApproach(userId: string): boolean {
  try { return localStorage.getItem(KEY(userId)) != null; } catch { return false; }
}

/**
 * Short human-readable summary for the AI coach system prompt so it can align
 * advice with the user's chosen approach. Defensive — accepts a loose object
 * because it's coming from JSONB without compile-time guarantees.
 */
export function summarizeApproachForCoach(input: Partial<ApproachState> | null | undefined): string {
  if (!input || typeof input !== "object") return "";
  const goal    = input.goalMode    && GOAL_MODE_META[input.goalMode];
  const pattern = input.mealPattern && MEAL_PATTERN_META[input.mealPattern];
  const timing  = input.trainingTiming && TRAINING_TIMING_META[input.trainingTiming];
  const window  = pattern && typeof input.firstMealHour24 === "number"
    ? fastingWindowLabel(input.mealPattern as MealPattern, input.firstMealHour24)
    : null;

  const lines: string[] = [];
  if (goal)    lines.push(`- Goal mode: ${goal.label} (${goal.sub})`);
  if (pattern) lines.push(`- Meal pattern: ${pattern.label} — ${pattern.tagline}`);
  if (timing)  lines.push(`- Training timing: ${timing.label} (${timing.sub})`);
  if (window)  lines.push(`- Eating window: ${window}`);
  lines.push(`- Carb cycling: ${input.carbCyclingOn ? "ON (high/low day rotation)" : "OFF (even daily macros)"}`);
  return lines.join("\n");
}

/** Map an intake primaryGoal string onto a default goal mode for first-load. */
export function goalModeFromIntake(primaryGoal: string | undefined | null): GoalMode | null {
  switch (primaryGoal) {
    case "fat_loss":
    case "weight_loss":
      return "cut";
    case "muscle_gain":
    case "strength":
      return "build";
    case "recomp":
    case "endurance":
    case "general":
    case "maintain":
      return "maintain";
    default:
      return null;
  }
}

// ─── Meal-pattern → meal slots + clock times ─────────────────────────────────

export type MealSlot = {
  key:   string;
  label: string;
  time:  string; // human "10:00 AM"
};

const fmt12 = (h24: number) => {
  const h = ((h24 + 11) % 12) + 1;
  const ap = h24 < 12 || h24 === 24 ? "AM" : "PM";
  return `${h}:00 ${ap}`;
};

/**
 * Generate meal times from the chosen pattern + first-meal hour.
 * Spacing comes from the ebook (16:8 = every 4hrs; 3 meals = every 5hrs).
 */
export function buildMealSchedule(pattern: MealPattern, firstHour24: number): MealSlot[] {
  const h = (offset: number) => ((firstHour24 + offset) % 24 + 24) % 24;
  switch (pattern) {
    case "three_plus_snacks":
      return [
        { key: "breakfast", label: "Breakfast",   time: fmt12(h(0))  },
        { key: "snack_1",   label: "Snack",       time: fmt12(h(3))  },
        { key: "lunch",     label: "Lunch",       time: fmt12(h(5))  },
        { key: "snack_2",   label: "Pre-workout", time: fmt12(h(8))  },
        { key: "dinner",    label: "Dinner",      time: fmt12(h(10)) },
      ];
    case "three":
      return [
        { key: "breakfast", label: "Breakfast", time: fmt12(h(0))  },
        { key: "lunch",     label: "Lunch",     time: fmt12(h(5))  },
        { key: "dinner",    label: "Dinner",    time: fmt12(h(10)) },
      ];
    case "two":
      return [
        { key: "brunch", label: "Brunch", time: fmt12(h(0)) },
        { key: "dinner", label: "Dinner", time: fmt12(h(6)) },
      ];
    case "if":
      return [
        { key: "meal_1", label: "First meal",  time: fmt12(h(0)) },
        { key: "meal_2", label: "Second meal", time: fmt12(h(4)) },
        { key: "meal_3", label: "Last meal",   time: fmt12(h(8)) },
      ];
    case "omad":
      return [
        { key: "meal", label: "One meal", time: fmt12(h(0)) },
      ];
  }
}

/** Fast window text for fasting patterns. */
export function fastingWindowLabel(pattern: MealPattern, firstHour24: number): string | null {
  if (pattern === "three_plus_snacks" || pattern === "three") return null;
  const start = ((firstHour24 % 24) + 24) % 24;
  if (pattern === "if")  return `8hr window — ${fmt12(start)} → ${fmt12((start + 8) % 24)} · fast 16hr`;
  if (pattern === "two") return `6hr window — ${fmt12(start)} → ${fmt12((start + 6) % 24)} · fast 18hr`;
  return `~1hr window — eat at ${fmt12(start)} · fast 23hr`;
}

// ─── Training-day carb pyramid (from ebook page 21) ──────────────────────────
// Returns percent-of-daily-carbs to allocate per meal slot, in order.

export type CarbAllocation = {
  slot:    string;
  percent: number;
  note?:   string;
};

export function buildCarbAllocation(
  pattern: MealPattern,
  timing:  TrainingTiming,
): CarbAllocation[] {
  const schedule = buildMealSchedule(pattern, 8);
  const labels   = schedule.map((s) => s.label);

  // The ebook pyramid: post-workout ~30-35%, next meal 20-25%, rest 10-15%.
  // Adapted to fewer meals by collapsing.
  const PW   = 33; // post-workout %
  const NXT  = 23; // next meal %
  const REST = 11; // each remaining meal %

  switch (timing) {
    case "fasted_am": {
      // Carbs come after the workout, biggest hit in meal 1.
      return labels.map((l, i) => ({
        slot: l,
        percent: i === 0 ? PW : i === 1 ? NXT : REST,
        note: i === 0 ? "Post-workout" : undefined,
      }));
    }
    case "after_1_meal": {
      // Pre 10-15% in meal 1, 30-35% post, 20-25% next, rest 10-15%.
      return labels.map((l, i) => ({
        slot: l,
        percent: i === 0 ? 12 : i === 1 ? PW : i === 2 ? NXT : REST,
        note: i === 0 ? "Pre-workout" : i === 1 ? "Post-workout" : undefined,
      }));
    }
    case "after_2_meals": {
      return labels.map((l, i) => ({
        slot: l,
        percent: i === 0 ? 12 : i === 1 ? 12 : i === 2 ? PW : i === 3 ? NXT : REST,
        note: i === 2 ? "Post-workout" : undefined,
      }));
    }
    case "after_3_meals": {
      return labels.map((l, i) => ({
        slot: l,
        percent: i < 3 ? 12 : i === 3 ? PW : 18,
        note: i === 3 ? "Post-workout" : undefined,
      }));
    }
  }
}

// ─── Carb-cycling math (from the ebook) ──────────────────────────────────────
// Cut:      low-day -25%, high-day -10% from TDEE, 3 low : 1 high
// Maintain: TDEE on both day types,                3 high : 2 low
// Build:    +10% surplus on both day types,        3 high : 2 low
// Protein:  1g / lb bodyweight regardless of day type
// Carbs:    50% of cals on high day, 20% of cals on low day
// Fat:      fills the remainder (9 kcal/g)

export type CycleDay = {
  type:     "high" | "low";
  calories: number;
  proteinG: number;
  carbsG:   number;
  fatG:     number;
};

export type CarbCycleBreakdown = {
  high:           CycleDay;
  low:            CycleDay;
  highPerWeek:    number;
  lowPerWeek:     number;
  ratioLabel:     string;
  proteinBasis:   "weight" | "fallback";
};

const round5 = (n: number) => Math.round(n / 5) * 5;

export function buildCarbCycleBreakdown(
  tdee: number,
  bodyWeightKg: number,
  goal: GoalMode,
): CarbCycleBreakdown {
  const hasWeight = bodyWeightKg > 0;
  const proteinG  = hasWeight
    ? Math.round(bodyWeightKg * 2.205)
    : Math.round(75 * 2.205);
  const proteinKcal = proteinG * 4;

  const calsFor = (deltaPct: number) => Math.max(1200, Math.round(tdee * (1 + deltaPct)));

  const highCals = goal === "cut" ? calsFor(-0.10) : goal === "maintain" ? calsFor(0) : calsFor(0.10);
  const lowCals  = goal === "cut" ? calsFor(-0.25) : goal === "maintain" ? calsFor(0) : calsFor(0.10);

  const high: CycleDay = (() => {
    const carbsG  = round5((highCals * 0.50) / 4);
    const fatKcal = Math.max(0, highCals - proteinKcal - carbsG * 4);
    return { type: "high", calories: highCals, proteinG, carbsG, fatG: round5(fatKcal / 9) };
  })();

  const low: CycleDay = (() => {
    const carbsG  = round5((lowCals * 0.20) / 4);
    const fatKcal = Math.max(0, lowCals - proteinKcal - carbsG * 4);
    return { type: "low", calories: lowCals, proteinG, carbsG, fatG: round5(fatKcal / 9) };
  })();

  const isCut = goal === "cut";
  return {
    high, low,
    highPerWeek:  isCut ? 1 : 3,
    lowPerWeek:   isCut ? 4 : 2,
    ratioLabel:   isCut ? "3 low : 1 high (5-day rotation)" : "3 high : 2 low (5-day rotation)",
    proteinBasis: hasWeight ? "weight" : "fallback",
  };
}
