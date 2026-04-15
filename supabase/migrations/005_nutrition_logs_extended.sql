-- ─── Nutrition logs: extend schema for structured meal data ──────────────────
-- Adds transcript, structured items, per-meal macro totals, soft-delete,
-- updated_at, and a separate hydration_logs table.

-- ─── 1. Extend nutrition_logs ─────────────────────────────────────────────────

ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS clean_transcript TEXT,
  ADD COLUMN IF NOT EXISTS raw_transcript   TEXT,
  ADD COLUMN IF NOT EXISTS items            JSONB,
  ADD COLUMN IF NOT EXISTS calories         INTEGER,
  ADD COLUMN IF NOT EXISTS protein          NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS carbs            NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS fat              NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS needs_review     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT now();

-- raw_text was NOT NULL; relax it — new records use raw_transcript instead
ALTER TABLE public.nutrition_logs
  ALTER COLUMN raw_text DROP NOT NULL;

-- Extend meal_type check to include 'unknown'
ALTER TABLE public.nutrition_logs
  DROP CONSTRAINT IF EXISTS nutrition_logs_meal_type_check;

ALTER TABLE public.nutrition_logs
  ADD CONSTRAINT nutrition_logs_meal_type_check
  CHECK (meal_type IN ('breakfast','lunch','dinner','snack','unknown'));

-- updated_at trigger (reuses set_updated_at() created in 001)
DROP TRIGGER IF EXISTS nutrition_logs_updated_at ON public.nutrition_logs;
CREATE TRIGGER nutrition_logs_updated_at
  BEFORE UPDATE ON public.nutrition_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Better index for date-range / active-record queries
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_logged_at
  ON public.nutrition_logs (user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_active
  ON public.nutrition_logs (user_id, logged_at DESC)
  WHERE deleted_at IS NULL;

-- ─── 2. Hydration logs table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hydration_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_ml       INTEGER     NOT NULL CHECK (amount_ml > 0),
  source          TEXT        NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('voice', 'manual', 'meal_parse')),
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_meal_id  UUID        REFERENCES public.nutrition_logs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hydration_logs_user_logged_at
  ON public.hydration_logs (user_id, logged_at DESC);

-- RLS
ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hydration_logs_select_own"
  ON public.hydration_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "hydration_logs_insert_own"
  ON public.hydration_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hydration_logs_delete_own"
  ON public.hydration_logs FOR DELETE
  USING (auth.uid() = user_id);
