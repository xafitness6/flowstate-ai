-- ─── Feedback reports ────────────────────────────────────────────────────────
-- In-app bug / feedback submissions. Captured via the floating bug button.
-- Any authenticated user can insert; only admins can read all rows.

CREATE TABLE IF NOT EXISTS public.feedback_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   TEXT,
  user_role    TEXT,
  category     TEXT        NOT NULL DEFAULT 'bug',  -- 'bug' | 'feature' | 'feedback'
  severity     TEXT        NOT NULL DEFAULT 'normal', -- 'low' | 'normal' | 'high' | 'critical'
  message      TEXT        NOT NULL,
  page_url     TEXT,
  user_agent   TEXT,
  -- Suggested fix from GPT-4o (optional; populated server-side at create time).
  ai_diagnosis TEXT,
  status       TEXT        NOT NULL DEFAULT 'open', -- 'open' | 'in_progress' | 'resolved' | 'wontfix'
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status     ON public.feedback_reports(status);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id    ON public.feedback_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback_reports(created_at DESC);

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert their own report
CREATE POLICY "feedback_insert_authenticated"
  ON public.feedback_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Users can see their own reports
CREATE POLICY "feedback_select_own"
  ON public.feedback_reports FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins see everything
CREATE POLICY "feedback_select_admin"
  ON public.feedback_reports FOR SELECT
  USING (public.is_admin());

CREATE POLICY "feedback_update_admin"
  ON public.feedback_reports FOR UPDATE
  USING (public.is_admin());
