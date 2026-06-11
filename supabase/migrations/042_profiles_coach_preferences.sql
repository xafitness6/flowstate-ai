-- 042 — Per-user coach voice preferences
-- Coach intensity (1 gentle → 5 militant) + strong-language opt-in live on the
-- profile so they persist across devices and so the AI coach reads them on
-- every server-side call instead of trusting client-supplied values.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_intensity      INTEGER NOT NULL DEFAULT 3
    CHECK (coach_intensity BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS coach_strong_language BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.coach_intensity      IS 'Coach delivery dial: 1=gentle, 3=balanced, 5=militant. Read server-side by /api/ai/coach.';
COMMENT ON COLUMN public.profiles.coach_strong_language IS 'Whether the coach is allowed to use strong language for emphasis.';

NOTIFY pgrst, 'reload schema';
