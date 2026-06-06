// ─── Client's nutrition approach ────────────────────────────────────────────
// GET → returns the stored ApproachState, or null when nothing's been saved yet
//       (also null when migration 030 hasn't been applied — silent degrade so
//        the page keeps working from localStorage).
// PATCH → upserts the ApproachState onto profiles.nutrition_approach (JSONB).
//
// Auth: client/member can read+write their own row. Trainer can read+write
// only their assigned clients. Admin can do anything.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

type GoalMode = "cut" | "maintain" | "build";
type MealPattern = "three_plus_snacks" | "three" | "two" | "if" | "omad";
type TrainingTiming = "fasted_am" | "after_1_meal" | "after_2_meals" | "after_3_meals";

type ApproachState = {
  goalMode:        GoalMode;
  mealPattern:     MealPattern;
  trainingTiming:  TrainingTiming;
  carbCyclingOn:   boolean;
  firstMealHour24: number;
};

const GOAL_MODES = new Set<GoalMode>(["cut", "maintain", "build"]);
const MEAL_PATTERNS = new Set<MealPattern>([
  "three_plus_snacks", "three", "two", "if", "omad",
]);
const TRAINING_TIMINGS = new Set<TrainingTiming>([
  "fasted_am", "after_1_meal", "after_2_meals", "after_3_meals",
]);

function sanitize(payload: unknown): ApproachState | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;

  const goalMode  = p.goalMode  as GoalMode;
  const mealPattern  = p.mealPattern  as MealPattern;
  const trainingTiming = p.trainingTiming as TrainingTiming;
  const carbCyclingOn  = p.carbCyclingOn === true;
  const rawHour = typeof p.firstMealHour24 === "number" ? p.firstMealHour24 : Number(p.firstMealHour24);
  const firstMealHour24 = Number.isFinite(rawHour) ? Math.max(0, Math.min(23, Math.round(rawHour))) : 8;

  if (!GOAL_MODES.has(goalMode)) return null;
  if (!MEAL_PATTERNS.has(mealPattern)) return null;
  if (!TRAINING_TIMINGS.has(trainingTiming)) return null;

  return { goalMode, mealPattern, trainingTiming, carbCyclingOn, firstMealHour24 };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id, { allowSelf: true });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("profiles")
    .select("nutrition_approach")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // Migration 030 not applied → degrade silently.
    return NextResponse.json({ approach: null, unavailable: true });
  }

  return NextResponse.json({ approach: data?.nutrition_approach ?? null });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id, { allowSelf: true });
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sanitized = sanitize(body);
  if (!sanitized) {
    return NextResponse.json({ error: "Invalid approach payload" }, { status: 400 });
  }

  const { error } = await auth.admin
    .from("profiles")
    .update({ nutrition_approach: sanitized })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Approach storage isn't ready yet. Apply migration 030." },
      { status: 503 },
    );
  }

  return NextResponse.json({ approach: sanitized, ok: true });
}
