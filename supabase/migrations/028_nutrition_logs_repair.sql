-- ─── Nutrition logs repair (schema-drift fix) ───────────────────────────────
-- The live nutrition_logs table predates 001/005/027 and is missing columns the
-- app writes to (source, clean_transcript, raw_transcript, items, macros,
-- needs_review, deleted_at, updated_at). Saving a meal failed with:
--   "Could not find the 'source' column of 'nutrition_logs' in the schema cache"
--
-- This migration is fully idempotent — safe to run on any state of the table.
-- Run it in the Supabase SQL editor (migrations are not auto-applied here).

-- 1. Every column the app's insert path needs ──────────────────────────────────
ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS source           TEXT,
  ADD COLUMN IF NOT EXISTS clean_transcript TEXT,
  ADD COLUMN IF NOT EXISTS raw_transcript   TEXT,
  ADD COLUMN IF NOT EXISTS items            JSONB,
  ADD COLUMN IF NOT EXISTS calories         INTEGER,
  ADD COLUMN IF NOT EXISTS protein          NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS carbs            NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS fat              NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS needs_review     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS parsed_data      JSONB,
  ADD COLUMN IF NOT EXISTS logged_at        TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. source default + allowed values (manual/voice/coach/photo/barcode) ─────────
ALTER TABLE public.nutrition_logs ALTER COLUMN source SET DEFAULT 'manual';
UPDATE public.nutrition_logs SET source = 'manual' WHERE source IS NULL;

ALTER TABLE public.nutrition_logs DROP CONSTRAINT IF EXISTS nutrition_logs_source_check;
ALTER TABLE public.nutrition_logs
  ADD CONSTRAINT nutrition_logs_source_check
  CHECK (source IN ('manual','voice','coach','photo','barcode'));

-- 3. raw_text was NOT NULL in the original schema — new rows use raw_transcript ──
ALTER TABLE public.nutrition_logs ALTER COLUMN raw_text DROP NOT NULL;

-- 4. meal_type must allow 'unknown' ────────────────────────────────────────────
ALTER TABLE public.nutrition_logs DROP CONSTRAINT IF EXISTS nutrition_logs_meal_type_check;
ALTER TABLE public.nutrition_logs
  ADD CONSTRAINT nutrition_logs_meal_type_check
  CHECK (meal_type IN ('breakfast','lunch','dinner','snack','unknown'));

-- 5. updated_at trigger + helpful indexes ──────────────────────────────────────
DROP TRIGGER IF EXISTS nutrition_logs_updated_at ON public.nutrition_logs;
CREATE TRIGGER nutrition_logs_updated_at
  BEFORE UPDATE ON public.nutrition_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_logged_at
  ON public.nutrition_logs (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_active
  ON public.nutrition_logs (user_id, logged_at DESC)
  WHERE deleted_at IS NULL;

-- 6. hydration_logs (water tracking) — ensure it exists too ─────────────────────
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

ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "hydration_logs_select_own" ON public.hydration_logs
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "hydration_logs_insert_own" ON public.hydration_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "hydration_logs_delete_own" ON public.hydration_logs
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Force PostgREST to refresh its schema cache so the new columns are visible ─
NOTIFY pgrst, 'reload schema';
