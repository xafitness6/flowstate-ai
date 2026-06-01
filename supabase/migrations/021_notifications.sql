-- ─────────────────────────────────────────────────────────────────────────────
-- 021 — Client notifications
-- In-app notification feed (bell). Rows are created server-side (service role)
-- when a coach acts on a client: onboarding sent, program assigned/changed,
-- nutrition/workout added, or a note left. The recipient reads + marks them read.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL DEFAULT 'general'
                CHECK (type IN ('general','onboarding','program_assigned','program_changed','nutrition_added','workout_added','note')),
  title       TEXT        NOT NULL,
  body        TEXT,
  link        TEXT,                      -- optional in-app route, e.g. /program
  actor_name  TEXT,                      -- who triggered it (the coach)
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipients read their own notifications and mark them read (UPDATE read_at).
-- Inserts happen via the service role only (server), so no INSERT policy.
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
