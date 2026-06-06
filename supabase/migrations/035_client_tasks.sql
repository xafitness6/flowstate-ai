-- 035 — Coach-assigned accountability tasks (check-in checklist items)
--
-- A trainer assigns checklist items to a client (e.g. after a check-in). They
-- show on the client's Accountability tab + profile + notifications, and the
-- Accountability nav highlights until the client opens it (seen_at). The client
-- checks items off; the coach sees progress.
CREATE TABLE IF NOT EXISTS public.client_tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by     UUID,
  assigned_by_name TEXT,
  title           TEXT        NOT NULL,
  detail          TEXT,
  due_date        DATE,
  done            BOOLEAN     NOT NULL DEFAULT false,
  done_at         TIMESTAMPTZ,
  seen_at         TIMESTAMPTZ,                     -- null = new/unseen by the client
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_tasks_client ON public.client_tasks(client_id, done, created_at DESC);

ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;

-- The client reads their own tasks and may update them (check off / mark seen).
-- Coach/admin writes (assign, edit, delete) go through the service role.
DROP POLICY IF EXISTS "client_tasks_select_own" ON public.client_tasks;
CREATE POLICY "client_tasks_select_own" ON public.client_tasks FOR SELECT USING (auth.uid() = client_id);
DROP POLICY IF EXISTS "client_tasks_update_own" ON public.client_tasks;
CREATE POLICY "client_tasks_update_own" ON public.client_tasks FOR UPDATE USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);
