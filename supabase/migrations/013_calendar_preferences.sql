-- ─── Calendar preferences ────────────────────────────────────────────────────
-- Per-user calendar sync settings + unique feed token. The user subscribes to
-- /api/calendar/feed/{token}.ics in their calendar app of choice.
-- The token is non-secret-but-non-guessable (UUIDv4 hex) and can be rotated
-- to revoke a leaked URL.

CREATE TABLE IF NOT EXISTS public.calendar_preferences (
  user_id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_token           TEXT        NOT NULL UNIQUE,

  -- What to sync
  include_workouts     BOOLEAN     NOT NULL DEFAULT true,
  include_rest_days    BOOLEAN     NOT NULL DEFAULT false,
  include_habits       BOOLEAN     NOT NULL DEFAULT true,
  include_meal_windows BOOLEAN     NOT NULL DEFAULT false,

  -- When to schedule (24h "HH:MM")
  workout_time         TEXT        NOT NULL DEFAULT '07:00',
  habits_time          TEXT        NOT NULL DEFAULT '08:00',

  -- Reminder minutes before — null = no reminder
  reminder_minutes     INT,

  -- Display colors (hex). Calendar apps mostly ignore color in iCal but Google does honor it.
  color_workout        TEXT        NOT NULL DEFAULT '#B48B40',
  color_habit          TEXT        NOT NULL DEFAULT '#93C5FD',

  -- How many weeks ahead to project. Larger windows = bigger feed.
  horizon_weeks        INT         NOT NULL DEFAULT 4,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_pref_token ON public.calendar_preferences(feed_token);

ALTER TABLE public.calendar_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_pref_select_own"
  ON public.calendar_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "calendar_pref_insert_own"
  ON public.calendar_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_pref_update_own"
  ON public.calendar_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "calendar_pref_delete_own"
  ON public.calendar_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypasses RLS — the feed endpoint uses it to look up the user
-- behind a token without requiring an auth session (calendar apps don't send
-- cookies; they just fetch the URL).
