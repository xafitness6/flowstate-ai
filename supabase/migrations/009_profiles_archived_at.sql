-- ─── Soft-delete / archive support for profiles ──────────────────────────────
-- Lets the admin dashboard "archive" a user without nuking their data.
-- Archived users keep their auth row + profile but are blocked from sign-in
-- by the application layer (AppShell + login flow check this column).
-- A hard delete via the admin API removes the auth.users row entirely; this
-- column is for the reversible path.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_archived_at_idx
  ON public.profiles (archived_at)
  WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN public.profiles.archived_at IS
  'Set to NOW() when an admin archives this user. Blocks app access without deleting data. NULL means active.';
