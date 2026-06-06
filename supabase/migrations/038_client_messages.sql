-- 038 — Direct trainer ↔ client messages (human coach chat, separate from the AI coach)
CREATE TABLE IF NOT EXISTS public.client_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL,
  from_coach BOOLEAN     NOT NULL,           -- true = coach→client, false = client→coach
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ                     -- set when the OTHER party has read it
);
CREATE INDEX IF NOT EXISTS idx_client_messages_thread ON public.client_messages(client_id, created_at);

ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;
-- The client reads their own thread and may send (from_coach = false). Coach
-- reads/sends via the service role (requireClientAccess).
DROP POLICY IF EXISTS "client_messages_select_own" ON public.client_messages;
CREATE POLICY "client_messages_select_own" ON public.client_messages FOR SELECT USING (auth.uid() = client_id);
DROP POLICY IF EXISTS "client_messages_insert_own" ON public.client_messages;
CREATE POLICY "client_messages_insert_own" ON public.client_messages FOR INSERT WITH CHECK (auth.uid() = client_id AND from_coach = false);
