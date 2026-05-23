-- App-owned password reset/setup tokens.
--
-- These replace Supabase's one-time email action links for the critical
-- password form path. Opening the email link only displays /reset-password;
-- the token is consumed when the user submits a new password.

CREATE TABLE IF NOT EXISTS public.auth_password_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  token_hash  TEXT        NOT NULL UNIQUE,
  purpose     TEXT        NOT NULL DEFAULT 'reset'
                           CHECK (purpose IN ('reset', 'invite', 'temp')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_password_tokens_user_id
  ON public.auth_password_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_password_tokens_expires_at
  ON public.auth_password_tokens(expires_at);

ALTER TABLE public.auth_password_tokens ENABLE ROW LEVEL SECURITY;

-- No browser/client access. Server routes use the service role.
DROP POLICY IF EXISTS "auth_password_tokens_no_client_select" ON public.auth_password_tokens;
DROP POLICY IF EXISTS "auth_password_tokens_no_client_insert" ON public.auth_password_tokens;
DROP POLICY IF EXISTS "auth_password_tokens_no_client_update" ON public.auth_password_tokens;
DROP POLICY IF EXISTS "auth_password_tokens_no_client_delete" ON public.auth_password_tokens;
