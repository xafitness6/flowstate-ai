-- ─── Multi-reminder customization ────────────────────────────────────────────
-- Replace the single `reminder_minutes` int with per-category arrays so users
-- can stack reminders ("1 hour before AND 15 minutes before") and have
-- different settings for workouts vs habits.

ALTER TABLE public.calendar_preferences
  ADD COLUMN IF NOT EXISTS reminders_workout INT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reminders_habit   INT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reminders_rest    INT[] NOT NULL DEFAULT '{}';

-- Backfill: anyone who had a single reminder_minutes value gets it copied
-- into reminders_workout + reminders_habit so existing setups don't break.
UPDATE public.calendar_preferences
SET
  reminders_workout = ARRAY[reminder_minutes],
  reminders_habit   = ARRAY[reminder_minutes]
WHERE reminder_minutes IS NOT NULL
  AND cardinality(reminders_workout) = 0
  AND cardinality(reminders_habit)   = 0;

-- Keep `reminder_minutes` for backwards compat with any code that still reads
-- it — it's harmless to leave the column.
