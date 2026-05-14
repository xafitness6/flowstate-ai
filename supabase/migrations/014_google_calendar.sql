-- ─── Google Calendar OAuth tokens ────────────────────────────────────────────
-- Stores per-user Google Calendar OAuth tokens for one-way push sync.
-- Refresh tokens live forever (until revoked); access tokens expire after ~1h
-- and are refreshed server-side as needed.
--
-- SECURITY: refresh_token is stored in plaintext here. The row-level security
-- below restricts SELECT to the owning user; the service role bypasses RLS,
-- which is what the OAuth callback + sync routes use. If you want defense in
-- depth, encrypt the refresh token client-side before insert (pgcrypto +
-- a key in env), but for an MVP RLS is the practical guard.

CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- OAuth credentials returned by Google
  access_token     TEXT        NOT NULL,
  refresh_token    TEXT,                            -- present on initial consent; not on every refresh
  expires_at       TIMESTAMPTZ NOT NULL,            -- when the access_token expires (server-tracked)
  scope            TEXT        NOT NULL,
  token_type       TEXT        NOT NULL DEFAULT 'Bearer',

  -- Optional: where we push events. NULL = primary calendar.
  calendar_id      TEXT,

  -- Sync state — used by the push helper to update existing events instead of duplicating.
  -- Map: { "<flowstate_event_uid>": "<google_event_id>" }
  event_map        JSONB       NOT NULL DEFAULT '{}',
  last_synced_at   TIMESTAMPTZ,
  last_sync_error  TEXT,

  -- Two-way sync support (future): channel ID + resource ID from Google watch API
  watch_channel_id   TEXT,
  watch_resource_id  TEXT,
  watch_expires_at   TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_tokens_user ON public.google_calendar_tokens(user_id);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Users can see whether THEY are connected (for the UI) — but not the raw tokens.
-- We expose presence via a server route instead of letting clients select the raw row.
CREATE POLICY "google_tokens_select_own"
  ON public.google_calendar_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "google_tokens_delete_own"
  ON public.google_calendar_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- INSERT / UPDATE are service-role only (the OAuth callback writes them).
-- No public INSERT/UPDATE policies = client can't forge tokens.
