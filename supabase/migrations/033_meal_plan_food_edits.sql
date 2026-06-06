-- 033 — Per-plan client food-edit permission
--
-- A coach can let a trusted client tweak the FOODS in their meal plan (swap
-- items, adjust portions) without ever changing the calorie/macro targets,
-- which stay coach-controlled. Off by default.
ALTER TABLE public.meal_plans
  ADD COLUMN IF NOT EXISTS allow_client_food_edits BOOLEAN NOT NULL DEFAULT false;
