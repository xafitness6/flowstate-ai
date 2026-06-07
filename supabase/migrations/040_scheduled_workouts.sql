-- 040 — Scheduled workouts (Trainerize-style): a coach assigns a workout to a
-- specific calendar day for a client. Shows on the client's calendar + drives
-- accountability. The client may RESCHEDULE (move the date) but not delete.
CREATE TABLE IF NOT EXISTS public.scheduled_workouts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id      UUID,
  workout_ref     TEXT,                 -- optional id/day key within the program
  title           TEXT        NOT NULL,
  scheduled_date  DATE        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'scheduled', -- scheduled | completed | skipped
  completed_log_id UUID,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_client ON public.scheduled_workouts(client_id, scheduled_date);

ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;
-- Client reads own + may update own (reschedule); coach manages via service role.
DROP POLICY IF EXISTS "scheduled_workouts_select_own" ON public.scheduled_workouts;
CREATE POLICY "scheduled_workouts_select_own" ON public.scheduled_workouts FOR SELECT USING (auth.uid() = client_id);
DROP POLICY IF EXISTS "scheduled_workouts_update_own" ON public.scheduled_workouts;
CREATE POLICY "scheduled_workouts_update_own" ON public.scheduled_workouts FOR UPDATE USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);
