-- ─── Exercises library ────────────────────────────────────────────────────────
-- Read-only catalog populated from the Free Exercise DB (MIT-licensed):
--   https://github.com/yuhonas/free-exercise-db
--
-- Run `npm run exercises:import` to populate (uses SUPABASE_SERVICE_ROLE_KEY).
-- Tagged with injury/contraindication metadata so we can filter "knee-safe",
-- "low-impact", etc. without a separate rehab database.

CREATE TABLE IF NOT EXISTS public.exercises (
  id                  TEXT        PRIMARY KEY,                              -- slug from source
  name                TEXT        NOT NULL,
  category            TEXT        NOT NULL,                                  -- "strength", "stretching", "cardio", "powerlifting", "plyometrics", "olympic_weightlifting", "strongman"
  force               TEXT,                                                  -- "push", "pull", "static"
  level               TEXT,                                                  -- "beginner", "intermediate", "expert"
  mechanic            TEXT,                                                  -- "compound", "isolation"
  equipment           TEXT,                                                  -- "barbell", "dumbbell", "bodyweight", etc.
  primary_muscles     TEXT[]      NOT NULL DEFAULT '{}',
  secondary_muscles   TEXT[]      NOT NULL DEFAULT '{}',
  instructions        TEXT[]      NOT NULL DEFAULT '{}',
  images              TEXT[]      NOT NULL DEFAULT '{}',                     -- relative paths from source
  -- Coaching metadata layered on top of source data:
  joint_load          TEXT,                                                  -- "low" | "moderate" | "high"
  injury_friendly_for TEXT[]      NOT NULL DEFAULT '{}',                     -- e.g. ['knee', 'lower_back', 'shoulder']
  contraindications   TEXT[]      NOT NULL DEFAULT '{}',                     -- e.g. ['acute_knee_injury', 'herniated_disc']
  source              TEXT        NOT NULL DEFAULT 'free-exercise-db',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercises_category_idx          ON public.exercises (category);
CREATE INDEX IF NOT EXISTS exercises_level_idx             ON public.exercises (level);
CREATE INDEX IF NOT EXISTS exercises_equipment_idx         ON public.exercises (equipment);
CREATE INDEX IF NOT EXISTS exercises_primary_muscles_idx   ON public.exercises USING gin (primary_muscles);
CREATE INDEX IF NOT EXISTS exercises_injury_friendly_idx   ON public.exercises USING gin (injury_friendly_for);
CREATE INDEX IF NOT EXISTS exercises_joint_load_idx        ON public.exercises (joint_load);

-- RLS: public read, no writes from clients (service role bypasses RLS for imports)
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises_select_all"
  ON public.exercises FOR SELECT
  USING (true);

-- No insert/update/delete policies — only service role can mutate.
