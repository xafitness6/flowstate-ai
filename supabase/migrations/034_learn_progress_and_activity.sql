-- 034 — Learn progress (cross-device + coach-visible) + app activity tracking
--
-- learn_progress: one row per completed Learn article. Users read/write their
-- own; coach/admin read via the service role (requireClientAccess).
CREATE TABLE IF NOT EXISTS public.learn_progress (
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  article_id   TEXT        NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);
ALTER TABLE public.learn_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learn_progress_select_own" ON public.learn_progress;
CREATE POLICY "learn_progress_select_own" ON public.learn_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "learn_progress_insert_own" ON public.learn_progress;
CREATE POLICY "learn_progress_insert_own" ON public.learn_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "learn_progress_delete_own" ON public.learn_progress;
CREATE POLICY "learn_progress_delete_own" ON public.learn_progress FOR DELETE USING (auth.uid() = user_id);

-- app_activity: one row per (user, day) the app was opened — gives "how often
-- they log in" (distinct active days) without storing a full event log.
CREATE TABLE IF NOT EXISTS public.app_activity (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.app_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_activity_select_own" ON public.app_activity;
CREATE POLICY "app_activity_select_own" ON public.app_activity FOR SELECT USING (auth.uid() = user_id);

-- Quick "last opened" stamp on the profile.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
