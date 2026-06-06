-- ─── profiles.nutrition_approach ─────────────────────────────────────────────
-- The user's chosen nutrition approach: goal mode + meal pattern + carb-cycling
-- toggle + first-meal hour. Persisted on the profile (one row per user, JSONB)
-- so the trainer sees the client's chosen pattern and the AI coach can read it
-- as context.
--
-- Shape (matches src/lib/nutrition/approach.ts → ApproachState):
--   {
--     "goalMode":        "cut" | "maintain" | "build",
--     "mealPattern":     "three_plus_snacks" | "three" | "two" | "if" | "omad",
--     "trainingTiming":  "fasted_am" | "after_1_meal" | "after_2_meals" | "after_3_meals",
--     "carbCyclingOn":   boolean,
--     "firstMealHour24": integer (6–18)
--   }
--
-- Idempotent: safe to run repeatedly.

alter table public.profiles
  add column if not exists nutrition_approach jsonb;

comment on column public.profiles.nutrition_approach is
  'Nutrition approach state: goal mode + meal pattern + carb cycling + first-meal hour. Shape mirrors ApproachState in src/lib/nutrition/approach.ts.';

-- Schema cache refresh so PostgREST picks up the new column without a restart.
notify pgrst, 'reload schema';
