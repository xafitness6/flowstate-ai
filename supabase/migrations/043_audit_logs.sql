-- 043 — Audit log for admin and self-service actions
-- An append-only record of who did what, to what, when.
-- Read by master/admin only; never written by clients directly — only by
-- server routes calling src/lib/server/audit.ts.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id     UUID,                                -- profiles.id of the actor; nullable for system actions
  actor_email  TEXT,                                -- snapshot so the row outlives the actor (deletion case)
  actor_role   TEXT,                                -- 'master' | 'trainer' | 'self' | 'system'
  action       TEXT NOT NULL,                       -- machine slug, e.g. 'assign_trainer', 'self_account_delete'
  target_kind  TEXT,                                -- 'user' | 'invite' | 'workout' | etc.
  target_id    TEXT,                                -- id of the target row (TEXT so non-uuid ids work)
  summary      TEXT,                                -- short human-readable description
  details      JSONB                                -- optional structured context (before/after snapshot, etc.)
);

CREATE INDEX IF NOT EXISTS audit_logs_occurred_at_idx ON public.audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx    ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx      ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_target_idx      ON public.audit_logs (target_kind, target_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins/masters can read.
DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;
CREATE POLICY audit_logs_select_admin ON public.audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND (p.role = 'master' OR p.is_admin = true))
  );

-- Writes are server-side only via the service role; no insert policy needed
-- for clients. Service role bypasses RLS.

COMMENT ON TABLE public.audit_logs IS 'Append-only audit trail. Written server-side via src/lib/server/audit.ts.';

NOTIFY pgrst, 'reload schema';
