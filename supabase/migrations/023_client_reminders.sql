-- 023 — Trainer reminders
-- Private to the trainer who created them (never shown to the client). A simple
-- per-client to-do so a coach can stay on track. API access goes through
-- requireClientAccess + service role; RLS restricts any direct access to the
-- owning trainer.
CREATE TABLE IF NOT EXISTS public.client_reminders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        TEXT        NOT NULL,
  due_date    DATE,
  done        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_reminders_client
  ON public.client_reminders(client_id, done, due_date);

ALTER TABLE public.client_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_reminders_select_own" ON public.client_reminders FOR SELECT USING (auth.uid() = trainer_id);
CREATE POLICY "client_reminders_insert_own" ON public.client_reminders FOR INSERT WITH CHECK (auth.uid() = trainer_id);
CREATE POLICY "client_reminders_update_own" ON public.client_reminders FOR UPDATE USING (auth.uid() = trainer_id);
CREATE POLICY "client_reminders_delete_own" ON public.client_reminders FOR DELETE USING (auth.uid() = trainer_id);
