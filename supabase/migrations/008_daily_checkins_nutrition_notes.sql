-- ─── Daily check-ins ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date                DATE        NOT NULL,
  identity_state      TEXT        CHECK (identity_state IN ('locked','focused','tired','off')),
  energy_note         TEXT,
  completed_habits    TEXT[]      NOT NULL DEFAULT '{}',
  key_done            BOOLEAN     NOT NULL DEFAULT false,
  score               INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TRIGGER daily_checkins_updated_at
  BEFORE UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_checkins_select_own"
  ON public.daily_checkins FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "daily_checkins_insert_own"
  ON public.daily_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_checkins_update_own"
  ON public.daily_checkins FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date
  ON public.daily_checkins (user_id, date DESC);

-- ─── Nutrition notes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nutrition_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date       DATE        NOT NULL,
  note       TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TRIGGER nutrition_notes_updated_at
  BEFORE UPDATE ON public.nutrition_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.nutrition_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_notes_select_own"
  ON public.nutrition_notes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "nutrition_notes_insert_own"
  ON public.nutrition_notes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_notes_update_own"
  ON public.nutrition_notes FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nutrition_notes_user_date
  ON public.nutrition_notes (user_id, date DESC);
