-- 031 — DB-backed nutrition targets + meal plans
--
-- nutrition_targets: a per-user manual override of calorie/macro/water goals.
-- Previously stored only in browser localStorage, which a coach could never
-- reach. Now persisted so a trainer can set a client's targets and the client
-- sees them on their own device. The user can read/write their OWN row (RLS);
-- trainer/admin writes go through requireClientAccess + the service role.
CREATE TABLE IF NOT EXISTS public.nutrition_targets (
  user_id     UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  calories    INTEGER,
  protein_g   INTEGER,
  carbs_g     INTEGER,
  fat_g       INTEGER,
  water_ml    INTEGER,
  updated_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_targets_select_own" ON public.nutrition_targets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nutrition_targets_insert_own" ON public.nutrition_targets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nutrition_targets_update_own" ON public.nutrition_targets FOR UPDATE USING (auth.uid() = user_id);

-- meal_plans: a coach- or AI-authored meal plan for a user. The plan body is
-- JSONB ({ meals: [...], totals: {...} }) so structure can evolve freely. One
-- "active" plan per user is shown; older ones are archived, not deleted.
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  summary         TEXT,
  plan            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT        NOT NULL DEFAULT 'active',  -- active | archived
  prompt          TEXT,                                   -- the coach's generation prompt
  created_by      UUID,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_user ON public.meal_plans(user_id, status, created_at DESC);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

-- The user can read their own plans; coach/admin writes go through the service role.
CREATE POLICY "meal_plans_select_own" ON public.meal_plans FOR SELECT USING (auth.uid() = user_id);
